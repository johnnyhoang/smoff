// Smoff — Mini Mobile App theo dõi không hút thuốc
// Trừ giờ ngủ: 23:00 (11:00 PM) -> 07:30 (7:30 AM)
// Đồng bộ Cloud đa thiết bị qua Vercel Blob (/api/state)

const STORAGE_KEY = 'smoff_state_v1';
const ONE_HOUR_MS = 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Kiểm tra một thời điểm (Date) có nằm trong giờ ngủ (23:00 - 07:30) hay không
 */
function isSleepingTime(date = new Date()) {
  const h = date.getHours();
  const m = date.getMinutes();
  if (h === 23) return true; // 23:00 -> 23:59:59
  if (h < 7 || (h === 7 && m < 30)) return true; // 00:00 -> 07:29:59
  return false;
}

/**
 * Tính chính xác thời gian THỨC (đã trừ khung ngủ 23:00 - 07:30 mỗi ngày)
 * giữa 2 mốc timestamp (ms).
 * Khung giờ thức mỗi ngày là [07:30:00.000, 23:00:00.000].
 */
function getAwakeDurationMs(startMs, endMs) {
  if (endMs <= startMs) return 0;

  const startDate = new Date(startMs);
  const endDate = new Date(endMs);

  const cursor = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate(),
    0, 0, 0, 0
  );

  const endDayMidnight = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate(),
    0, 0, 0, 0
  ).getTime();

  let totalAwakeMs = 0;

  while (cursor.getTime() <= endDayMidnight) {
    const y = cursor.getFullYear();
    const mo = cursor.getMonth();
    const d = cursor.getDate();

    const awakeStart = new Date(y, mo, d, 7, 30, 0, 0).getTime();
    const awakeEnd = new Date(y, mo, d, 23, 0, 0, 0).getTime();

    const overlapStart = Math.max(startMs, awakeStart);
    const overlapEnd = Math.min(endMs, awakeEnd);

    if (overlapEnd > overlapStart) {
      totalAwakeMs += overlapEnd - overlapStart;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return totalAwakeMs;
}

/**
 * Lấy chuỗi YYYY-MM-DD theo giờ địa phương để đếm số điếu trong ngày
 */
function getLocalDateKey(ms = Date.now()) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Định dạng mili-giây thành HH:MM:SS cho đồng hồ chính
 */
function formatHMS(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [
    String(h).padStart(2, '0'),
    String(m).padStart(2, '0'),
    String(s).padStart(2, '0')
  ].join(':');
}

/**
 * Định dạng mili-giây ngắn gọn (vd: "2h 12p", "45p 10s", "1h 06p")
 */
function formatShortDuration(ms) {
  if (!ms || ms <= 0) return '0p';
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h > 0) {
    return `${h}h ${String(m).padStart(2, '0')}p`;
  }
  if (m > 0) {
    return s > 0 && m < 10 ? `${m}p ${s}s` : `${m}p`;
  }
  return `${s}s`;
}

function formatTimeHHMM(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Khởi tạo / Đọc trạng thái từ localStorage
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        streakStartMs: parsed.streakStartMs || Date.now(),
        lastCheckInMs: parsed.lastCheckInMs || parsed.streakStartMs || Date.now(),
        logs: Array.isArray(parsed.logs) ? parsed.logs : [],
        lastAlertedHourCycle: parsed.lastAlertedHourCycle || 0,
        updatedAt: parsed.updatedAt || 0
      };
    }
  } catch (e) {
    console.error('Failed to load state:', e);
  }
  const now = Date.now();
  return {
    streakStartMs: now,
    lastCheckInMs: now,
    logs: [],
    lastAlertedHourCycle: 0,
    updatedAt: 0
  };
}

function saveLocalState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

let state = loadState();
let isSyncing = false;

// DOM Elements
const statusDot = document.getElementById('statusDot');
const syncBadge = document.getElementById('syncBadge');
const sleepBanner = document.getElementById('sleepBanner');
const currentStreakTimer = document.getElementById('currentStreakTimer');
const lastSmokeLabel = document.getElementById('lastSmokeLabel');
const liveRecordBadge = document.getElementById('liveRecordBadge');
const hourlyBarFill = document.getElementById('hourlyBarFill');
const nextCheckInText = document.getElementById('nextCheckInText');

const pastRecordValue = document.getElementById('pastRecordValue');
const monthlyAvgValue = document.getElementById('monthlyAvgValue');
const monthlyAvgSub = document.getElementById('monthlyAvgSub');
const todayCountValue = document.getElementById('todayCountValue');
const todayCountSub = document.getElementById('todayCountSub');

const previewSplit1 = document.getElementById('previewSplit1');
const previewSplit2 = document.getElementById('previewSplit2');
const previewSplit3 = document.getElementById('previewSplit3');

const logList = document.getElementById('logList');
const btnUndo = document.getElementById('btnUndo');
const btnResetStart = document.getElementById('btnResetStart');
const btnTestPopup = document.getElementById('btnTestPopup');
const btnNotif = document.getElementById('btnNotif');

const hourlyModal = document.getElementById('hourlyModal');
const modalCurrentStreak = document.getElementById('modalCurrentStreak');
const modalPastRecord = document.getElementById('modalPastRecord');
const modalMonthlyAvg = document.getElementById('modalMonthlyAvg');
const modalTodayCount = document.getElementById('modalTodayCount');
const modalSplit1 = document.getElementById('modalSplit1');
const modalSplit2 = document.getElementById('modalSplit2');
const modalSplit3 = document.getElementById('modalSplit3');

const toastEl = document.getElementById('toast');
let toastTimeout = null;

function setSyncStatus(text, isSynced = false) {
  if (!syncBadge) return;
  syncBadge.textContent = text;
  if (isSynced) {
    syncBadge.classList.add('synced');
  } else {
    syncBadge.classList.remove('synced');
  }
}

/**
 * Đẩy trạng thái hiện tại lên Vercel Blob qua /api/state
 */
async function pushCloudState() {
  state.updatedAt = Date.now();
  saveLocalState();
  setSyncStatus('🔄 Đang lưu...', false);

  try {
    const res = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
    if (res.ok) {
      setSyncStatus('☁️ Đã đồng bộ', true);
    } else {
      setSyncStatus('⚠️ Lưu cục bộ', false);
    }
  } catch (err) {
    setSyncStatus('⚠️ Offline', false);
  }
}

/**
 * Tải trạng thái mới nhất từ Vercel Blob qua /api/state
 */
async function pullCloudState() {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const res = await fetch(`/api/state?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) {
      isSyncing = false;
      return;
    }
    const cloud = await res.json();
    if (cloud && cloud.empty) {
      // Cloud chưa có dữ liệu -> đẩy trạng thái máy hiện tại lên làm gốc
      await pushCloudState();
      isSyncing = false;
      return;
    }

    if (cloud && typeof cloud.streakStartMs === 'number') {
      const cloudUpdated = Number(cloud.updatedAt) || 0;
      const localUpdated = Number(state.updatedAt) || 0;

      if (cloudUpdated > localUpdated) {
        state = {
          streakStartMs: cloud.streakStartMs,
          lastCheckInMs: cloud.lastCheckInMs || cloud.streakStartMs,
          logs: Array.isArray(cloud.logs) ? cloud.logs : [],
          lastAlertedHourCycle: Number(cloud.lastAlertedHourCycle) || 0,
          updatedAt: cloudUpdated
        };
        saveLocalState();
        renderLogs();
        updateUI(Date.now());
      } else if (localUpdated > cloudUpdated) {
        await pushCloudState();
      }
      setSyncStatus('☁️ Đã đồng bộ', true);
    }
  } catch (err) {
    setSyncStatus('⚠️ Offline', false);
  } finally {
    isSyncing = false;
  }
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 3200);
}

/**
 * Tính toán các chỉ số thống kê từ lịch sử:
 * - Kỷ lục trong quá khứ (max của các khoảng eachIntervalMs đã ghi nhận)
 * - Trung bình 1 tháng qua (tổng thời gian thức / tổng số điếu trong 30 ngày)
 * - Số điếu trong ngày hôm nay
 */
function computeMetrics(nowMs = Date.now()) {
  const todayKey = getLocalDateKey(nowMs);
  const cutoff30d = nowMs - THIRTY_DAYS_MS;

  let pastRecordMs = 0;
  let sumAwake30d = 0;
  let sumCigs30d = 0;
  let todayCigs = 0;

  for (const item of state.logs) {
    if (item.eachIntervalMs > pastRecordMs) {
      pastRecordMs = item.eachIntervalMs;
    }
    if (item.timestamp >= cutoff30d) {
      sumAwake30d += item.totalAwakeMs;
      sumCigs30d += item.count;
    }
    if (item.dateKey === todayKey) {
      todayCigs += item.count;
    }
  }

  const monthlyAvgMs = sumCigs30d > 0 ? Math.round(sumAwake30d / sumCigs30d) : 0;

  return {
    pastRecordMs,
    monthlyAvgMs,
    sumCigs30d,
    todayCigs
  };
}

/**
 * Phát âm báo nhẹ + rung khi nổi popup 1 tiếng
 */
function playHourlyAlertSound() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([180, 100, 180]);
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99]; // C5 - E5 - G5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + idx * 0.14 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.14 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.14);
      osc.stop(ctx.currentTime + idx * 0.14 + 0.3);
    });
  } catch (err) {
    // Ignore audio errors if user hasn't interacted yet
  }
}

/**
 * Gửi thông báo hệ thống (Web Notification) nếu được cấp quyền
 */
function sendHourlyNotification(currentAwakeMs, metrics) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const title = `⏰ Đã duy trì ${formatShortDuration(currentAwakeMs)} không hút!`;
  const body = `Kỷ lục: ${formatShortDuration(metrics.pastRecordMs)} • TB 1 tháng: ${formatShortDuration(metrics.monthlyAvgMs)} • Hôm nay: ${metrics.todayCigs} điếu. Chạm để chọn Đã hút 1, 2, 3 hoặc Chưa hút.`;

  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        body,
        icon: 'icon.svg',
        badge: 'icon.svg',
        tag: 'smoff-hourly-checkin',
        renotify: true
      });
    });
  } else {
    const n = new Notification(title, { body, icon: 'icon.svg', tag: 'smoff-hourly-checkin' });
    n.onclick = () => {
      window.focus();
      openHourlyModal();
    };
  }
}

function openHourlyModal() {
  hourlyModal.classList.remove('hidden');
  updateUI(Date.now());
}

function closeHourlyModal() {
  hourlyModal.classList.add('hidden');
}

/**
 * Xử lý khi bấm 1 trong 4 nút:
 * - count = 0: "Chưa hút" -> giữ nguyên bộ đếm, chỉ đặt lại mốc nhắc 1 tiếng
 * - count = 1, 2, 3: "Đã hút 1/2/3" -> chia khoảng thời gian thức từ lần bấm trước cho count,
 *   lưu vào lịch sử, cộng số điếu trong ngày, và reset bộ đếm về 0.
 */
function handleSmokeButton(count) {
  const now = Date.now();

  if (count === 0) {
    state.lastCheckInMs = now;
    state.lastAlertedHourCycle = 0;
    closeHourlyModal();
    const currentAwakeMs = getAwakeDurationMs(state.streakStartMs, now);
    showToast(`✅ Tuyệt vời! Tiếp tục giữ chuỗi ${formatShortDuration(currentAwakeMs)}`);
    updateUI(now);
    pushCloudState();
    return;
  }

  // Đã hút 1, 2 hoặc 3 điếu
  const totalAwakeMs = getAwakeDurationMs(state.streakStartMs, now);
  const eachIntervalMs = Math.round(totalAwakeMs / count);

  const newEntry = {
    id: `${now}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now,
    dateKey: getLocalDateKey(now),
    count,
    totalAwakeMs,
    eachIntervalMs,
    prevStreakStartMs: state.streakStartMs,
    prevCheckInMs: state.lastCheckInMs
  };

  state.logs.unshift(newEntry);
  state.streakStartMs = now;
  state.lastCheckInMs = now;
  state.lastAlertedHourCycle = 0;

  closeHourlyModal();
  renderLogs();
  updateUI(now);
  pushCloudState();

  if (count === 1) {
    showToast(`Đã ghi 1 điếu (${formatShortDuration(eachIntervalMs)}) • Đã reset bộ đếm`);
  } else {
    showToast(
      `Đã ghi ${count} điếu • Chia đều ${formatShortDuration(eachIntervalMs)}/điếu (từ ${formatShortDuration(totalAwakeMs)})`
    );
  }
}

/**
 * Hoàn tác lần bấm "Đã hút" gần nhất nếu bấm nhầm
 */
function handleUndo() {
  if (state.logs.length === 0) return;
  const last = state.logs.shift();
  if (last && last.prevStreakStartMs) {
    state.streakStartMs = last.prevStreakStartMs;
    state.lastCheckInMs = last.prevCheckInMs || last.prevStreakStartMs;
    state.lastAlertedHourCycle = 0;
  }
  renderLogs();
  updateUI(Date.now());
  pushCloudState();
  showToast('↩ Đã hoàn tác lần bấm gần nhất');
}

/**
 * Đặt lại mốc bắt đầu đếm hiện tại về bây giờ (không thêm điếu thuốc)
 */
function handleResetStart() {
  if (!confirm('Đặt lại đồng hồ đếm hiện tại về 00:00:00 (lịch sử cũ vẫn giữ nguyên)?')) {
    return;
  }
  const now = Date.now();
  state.streakStartMs = now;
  state.lastCheckInMs = now;
  state.lastAlertedHourCycle = 0;
  updateUI(now);
  pushCloudState();
  showToast('Đã đặt lại đồng hồ về 00:00:00');
}

/**
 * Hiển thị danh sách các lần bấm trong ngày hôm nay
 */
function renderLogs() {
  const todayKey = getLocalDateKey(Date.now());
  const todayLogs = state.logs.filter((l) => l.dateKey === todayKey);

  if (state.logs.length > 0) {
    btnUndo.classList.remove('hidden');
  } else {
    btnUndo.classList.add('hidden');
  }

  if (todayLogs.length === 0) {
    logList.innerHTML = `<div class="empty-log">Chưa có lần hút nào được ghi nhận hôm nay</div>`;
    return;
  }

  logList.innerHTML = todayLogs
    .map((item) => {
      const splitExplain =
        item.count > 1
          ? `${formatShortDuration(item.eachIntervalMs)}/điếu × ${item.count} (tổng ${formatShortDuration(item.totalAwakeMs)})`
          : `Nhịn được ${formatShortDuration(item.eachIntervalMs)}`;
      return `
        <div class="log-item">
          <div class="log-left">
            <span class="log-pill">+${item.count} điếu</span>
            <span>${splitExplain}</span>
          </div>
          <span class="log-right">${formatTimeHHMM(item.timestamp)}</span>
        </div>
      `;
    })
    .join('');
}

/**
 * Cập nhật giao diện mỗi giây & kiểm tra mốc nhắc 1 tiếng
 */
function updateUI(now = Date.now()) {
  const sleeping = isSleepingTime(new Date(now));

  if (sleeping) {
    statusDot.classList.add('sleeping');
    sleepBanner.classList.remove('hidden');
  } else {
    statusDot.classList.remove('sleeping');
    sleepBanner.classList.add('hidden');
  }

  // Thời gian thức đã duy trì từ lần hút gần nhất
  const currentAwakeMs = getAwakeDurationMs(state.streakStartMs, now);
  currentStreakTimer.textContent = formatHMS(currentAwakeMs);

  const lastLog = state.logs[0];
  if (lastLog) {
    lastSmokeLabel.textContent = `Từ lần hút gần nhất lúc ${formatTimeHHMM(lastLog.timestamp)} (trừ ngủ 23:00–07:30)`;
  } else {
    lastSmokeLabel.textContent = `Bắt đầu đếm lúc ${formatTimeHHMM(state.streakStartMs)} (trừ ngủ 23:00–07:30)`;
  }

  // Tính các chỉ số
  const metrics = computeMetrics(now);

  pastRecordValue.textContent = formatShortDuration(metrics.pastRecordMs);
  monthlyAvgValue.textContent = formatShortDuration(metrics.monthlyAvgMs);
  monthlyAvgSub.textContent =
    metrics.sumCigs30d > 0 ? `Qua ${metrics.sumCigs30d} điếu (30 ngày)` : 'Chưa có điếu nào';
  todayCountValue.textContent = String(metrics.todayCigs);
  todayCountSub.textContent =
    metrics.todayCigs === 0 ? 'Chưa hút điếu nào' : `Đã hút hôm nay`;

  // Hiển thị huy hiệu nếu chuỗi hiện tại đang vượt kỷ lục cũ (khi đã có kỷ lục cũ)
  if (metrics.pastRecordMs > 0 && currentAwakeMs > metrics.pastRecordMs) {
    liveRecordBadge.classList.remove('hidden');
  } else {
    liveRecordBadge.classList.add('hidden');
  }

  // Cập nhật preview chia thời gian trên 3 nút (T/1, T/2, T/3)
  const split1Text = `${formatShortDuration(currentAwakeMs)} / điếu`;
  const split2Text = `${formatShortDuration(Math.round(currentAwakeMs / 2))} / điếu`;
  const split3Text = `${formatShortDuration(Math.round(currentAwakeMs / 3))} / điếu`;

  previewSplit1.textContent = split1Text;
  previewSplit2.textContent = split2Text;
  previewSplit3.textContent = split3Text;

  // Cập nhật số liệu trong Modal 1 tiếng
  modalCurrentStreak.textContent = formatShortDuration(currentAwakeMs);
  modalPastRecord.textContent = formatShortDuration(metrics.pastRecordMs);
  modalMonthlyAvg.textContent = formatShortDuration(metrics.monthlyAvgMs);
  modalTodayCount.textContent = `${metrics.todayCigs} điếu`;
  modalSplit1.textContent = split1Text;
  modalSplit2.textContent = split2Text;
  modalSplit3.textContent = split3Text;

  // Tiến độ 1 tiếng thức kể từ lần check-in gần nhất
  const awakeSinceCheckInMs = getAwakeDurationMs(state.lastCheckInMs, now);
  const progressPct = Math.min(100, (awakeSinceCheckInMs / ONE_HOUR_MS) * 100);
  hourlyBarFill.style.width = `${progressPct.toFixed(1)}%`;

  const remainingMs = Math.max(0, ONE_HOUR_MS - (awakeSinceCheckInMs % ONE_HOUR_MS));
  const remMin = Math.floor(remainingMs / 60000);
  const remSec = Math.floor((remainingMs % 60000) / 1000);

  if (sleeping) {
    nextCheckInText.textContent = 'Đang giờ ngủ (tạm dừng)';
  } else {
    nextCheckInText.textContent = `Còn ${remMin}p${String(remSec).padStart(2, '0')}s nổi nhắc`;
  }

  // Kiểm tra nếu đã đủ >= 1 tiếng thức (và không trong giờ ngủ) thì nổi Popup
  const currentHourCycle = Math.floor(awakeSinceCheckInMs / ONE_HOUR_MS);
  if (!sleeping && currentHourCycle >= 1 && currentHourCycle > state.lastAlertedHourCycle) {
    state.lastAlertedHourCycle = currentHourCycle;
    saveLocalState();
    openHourlyModal();
    playHourlyAlertSound();
    sendHourlyNotification(currentAwakeMs, metrics);
  }
}

/**
 * Cài đặt quyền Web Notification
 */
function updateNotifButtonUI() {
  if (!('Notification' in window)) {
    btnNotif.textContent = '🔕 Không hỗ trợ';
    return;
  }
  if (Notification.permission === 'granted') {
    btnNotif.textContent = '🔔 Đã bật nhắc';
    btnNotif.classList.add('active-notif');
  } else if (Notification.permission === 'denied') {
    btnNotif.textContent = '🔕 Đã chặn TB';
    btnNotif.classList.remove('active-notif');
  } else {
    btnNotif.textContent = '🔔 Bật nhắc';
    btnNotif.classList.remove('active-notif');
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('Trình duyệt này không hỗ trợ thông báo đẩy');
    return;
  }
  const perm = await Notification.requestPermission();
  updateNotifButtonUI();
  if (perm === 'granted') {
    showToast('🔔 Đã bật thông báo nhắc mỗi 1 tiếng!');
  } else {
    showToast('Bạn có thể cấp quyền thông báo trong Cài đặt trình duyệt');
  }
}

// Gắn sự kiện cho tất cả các nút [data-smoke] (cả màn hình chính & trong popup)
document.querySelectorAll('[data-smoke]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const count = Number(btn.getAttribute('data-smoke'));
    handleSmokeButton(count);
  });
});

btnUndo.addEventListener('click', handleUndo);
btnResetStart.addEventListener('click', handleResetStart);
btnTestPopup.addEventListener('click', () => {
  openHourlyModal();
  playHourlyAlertSound();
});
btnNotif.addEventListener('click', requestNotificationPermission);

// Đăng ký Service Worker cho PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'OPEN_HOURLY_PROMPT') {
      openHourlyModal();
    }
  });
}

// Mở popup ngay nếu đi từ thông báo vào (?prompt=1)
if (new URLSearchParams(window.location.search).get('prompt') === '1') {
  openHourlyModal();
}

// Khởi chạy ban đầu + đồng bộ dữ liệu Cloud
updateNotifButtonUI();
renderLogs();
updateUI(Date.now());
pullCloudState();

// Tự động đồng bộ khi chuyển lại tab/mở lại màn hình ĐT hoặc mỗi 5 giây
window.addEventListener('focus', () => pullCloudState());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    pullCloudState();
  }
});
setInterval(() => {
  pullCloudState();
}, 5000);

// Cập nhật đồng hồ mỗi giây
setInterval(() => {
  updateUI(Date.now());
}, 1000);
