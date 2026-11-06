// Smoff — Mini Mobile App theo dõi không hút thuốc
// Trừ giờ ngủ: 23:00 (11:00 PM) -> 07:30 (7:30 AM)
// Đồng bộ Cloud đa thiết bị theo người dùng qua Vercel Blob (/api/state?user=...)

const ACTIVE_USER_KEY = 'smoff_active_user';
const RECENT_USERS_KEY = 'smoff_recent_users';
const ONE_HOUR_MS = 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeUser(raw) {
  if (!raw || typeof raw !== 'string') return 'johnnyhoang';
  const clean = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return clean || 'johnnyhoang';
}

function getActiveUser() {
  return normalizeUser(localStorage.getItem(ACTIVE_USER_KEY) || 'johnnyhoang');
}

function setActiveUser(user) {
  const clean = normalizeUser(user);
  localStorage.setItem(ACTIVE_USER_KEY, clean);

  // Lưu vào danh sách gần đây
  const recents = getRecentUsers();
  if (!recents.includes(clean)) {
    recents.unshift(clean);
    localStorage.setItem(RECENT_USERS_KEY, JSON.stringify(recents.slice(0, 8)));
  }
  return clean;
}

function getRecentUsers() {
  try {
    const raw = localStorage.getItem(RECENT_USERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(normalizeUser);
    }
  } catch (e) {}
  return ['johnnyhoang'];
}

let currentUser = getActiveUser();

function getStorageKey(user = currentUser) {
  return `smoff_state_${user}`;
}

// Cố định múi giờ Việt Nam (UTC+7, Asia/Ho_Chi_Minh) cho toàn bộ logic tính giờ ngủ, chuỗi thức và ngày lịch sử
// Khắc phục hoàn toàn lệch giờ giữa Server (Singapore/UTC) và Client (VN/Phone/Laptop)
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function getVNDateParts(ms = Date.now()) {
  const ts = ms instanceof Date ? ms.getTime() : (Number(ms) || Date.now());
  const d = new Date(ts + VN_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    date: d.getUTCDate(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
    seconds: d.getUTCSeconds(),
    day: d.getUTCDay()
  };
}

/**
 * Kiểm tra một thời điểm có nằm trong giờ ngủ (23:00 - 07:30 theo giờ Việt Nam) hay không
 */
function isSleepingTime(ms = Date.now()) {
  const { hours, minutes } = getVNDateParts(ms);
  if (hours === 23) return true; // 23:00 -> 23:59:59 VN
  if (hours < 7 || (hours === 7 && minutes < 30)) return true; // 00:00 -> 07:29:59 VN
  return false;
}

/**
 * Tính chính xác thời gian THỨC (đã trừ khung ngủ 23:00 - 07:30 mỗi ngày theo giờ Việt Nam)
 */
function getAwakeDurationMs(startMs, endMs) {
  if (!startMs || !endMs || endMs <= startMs) return 0;

  const startVN = getVNDateParts(startMs);
  const endVN = getVNDateParts(endMs);

  // Mốc 00:00:00 giờ Việt Nam (quy đổi sang UTC ms chuẩn xác)
  let curMidnightUTC = Date.UTC(startVN.year, startVN.month, startVN.date, 0, 0, 0) - VN_OFFSET_MS;
  const endMidnightUTC = Date.UTC(endVN.year, endVN.month, endVN.date, 0, 0, 0) - VN_OFFSET_MS;

  let totalAwakeMs = 0;

  while (curMidnightUTC <= endMidnightUTC) {
    const awakeStart = curMidnightUTC + (7 * 3600 + 30 * 60) * 1000; // 07:30 VN
    const awakeEnd = curMidnightUTC + 23 * 3600 * 1000;             // 23:00 VN

    const overlapStart = Math.max(startMs, awakeStart);
    const overlapEnd = Math.min(endMs, awakeEnd);

    if (overlapEnd > overlapStart) {
      totalAwakeMs += overlapEnd - overlapStart;
    }

    curMidnightUTC += 24 * 3600 * 1000; // Sang ngày VN tiếp theo
  }

  return totalAwakeMs;
}

function getLocalDateKey(ms = Date.now()) {
  const { year, month, date } = getVNDateParts(ms);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
}

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
  const { hours, minutes } = getVNDateParts(ms);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function loadState(user = currentUser) {
  try {
    // Thử đọc state theo key của user
    let raw = localStorage.getItem(getStorageKey(user));
    // Nếu là johnnyhoang và chưa có key riêng, đọc fallback từ legacy key
    if (!raw && user === 'johnnyhoang') {
      raw = localStorage.getItem('smoff_state_v1');
    }
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
    localStorage.setItem(getStorageKey(currentUser), JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

let state = loadState(currentUser);
let isSyncing = false;

// DOM Elements
const statusDot = document.getElementById('statusDot');
const headerUserName = document.getElementById('headerUserName');
const btnUserModal = document.getElementById('btnUserModal');
const userModal = document.getElementById('userModal');
const btnCloseUserModal = document.getElementById('btnCloseUserModal');
const userForm = document.getElementById('userForm');
const userNameInput = document.getElementById('userNameInput');
const recentUsersSection = document.getElementById('recentUsersSection');
const recentUsersList = document.getElementById('recentUsersList');

const sleepBanner = document.getElementById('sleepBanner');
const currentStreakTimer = document.getElementById('currentStreakTimer');
const lastSmokeLabel = document.getElementById('lastSmokeLabel');
const liveRecordBadge = document.getElementById('liveRecordBadge');

const pastRecordValue = document.getElementById('pastRecordValue');
const monthlyAvgValue = document.getElementById('monthlyAvgValue');
const monthlyAvgSub = document.getElementById('monthlyAvgSub');
const todayCountValue = document.getElementById('todayCountValue');
const todayCountSub = document.getElementById('todayCountSub');

const logList = document.getElementById('logList');
const btnUndo = document.getElementById('btnUndo');
const btnTestPopup = document.getElementById('btnTestPopup');

const hourlyModal = document.getElementById('hourlyModal');
const modalCurrentStreak = document.getElementById('modalCurrentStreak');
const modalPastRecord = document.getElementById('modalPastRecord');
const modalMonthlyAvg = document.getElementById('modalMonthlyAvg');
const modalTodayCount = document.getElementById('modalTodayCount');

const toastEl = document.getElementById('toast');
let toastTimeout = null;

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 3000);
}

/**
 * Hợp nhất thông minh state giữa Local và Cloud:
 * 1. Ghép danh sách logs theo ID / Timestamp để không bao giờ bị mất điếu hút nào.
 * 2. Xác định mốc streakStartMs từ lần hút gần nhất trong logs (chống lỗi hiển thị 34 tiếng khi mở thiết bị cũ).
 */
function mergeStates(local, cloud) {
  if (!cloud || typeof cloud.streakStartMs !== 'number') return local;
  if (!local) return cloud;

  const logMap = new Map();
  (local.logs || []).forEach((l) => {
    if (l && l.timestamp) logMap.set(l.id || String(l.timestamp), l);
  });
  (cloud.logs || []).forEach((l) => {
    if (l && l.timestamp) logMap.set(l.id || String(l.timestamp), l);
  });

  const mergedLogs = Array.from(logMap.values());
  mergedLogs.sort((a, b) => b.timestamp - a.timestamp);

  let latestStreakStartMs = Math.max(local.streakStartMs || 0, cloud.streakStartMs || 0);
  if (mergedLogs.length > 0) {
    // Nếu có nhật ký, chuỗi hiện tại PHẢI bắt đầu từ lần hút gần nhất
    latestStreakStartMs = mergedLogs[0].timestamp;
  }

  const latestCheckInMs = Math.max(local.lastCheckInMs || 0, cloud.lastCheckInMs || 0, latestStreakStartMs);
  const latestUpdatedAt = Math.max(local.updatedAt || 0, cloud.updatedAt || 0);

  return {
    streakStartMs: latestStreakStartMs,
    lastCheckInMs: latestCheckInMs,
    logs: mergedLogs.slice(0, 1000),
    lastAlertedHourCycle: Math.max(local.lastAlertedHourCycle || 0, cloud.lastAlertedHourCycle || 0),
    updatedAt: latestUpdatedAt
  };
}

/**
 * Đẩy trạng thái của currentUser lên Vercel Blob
 */
async function pushCloudState() {
  state.updatedAt = Date.now();
  saveLocalState();

  try {
    const res = await fetch('/api/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...state,
        user: currentUser
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.state) {
        state = mergeStates(state, data.state);
        saveLocalState();
      }
    }
  } catch (err) {}
}

/**
 * Tải trạng thái mới nhất của currentUser từ Vercel Blob và merge an toàn
 */
async function pullCloudState() {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const res = await fetch(`/api/state?user=${encodeURIComponent(currentUser)}&t=${Date.now()}`, {
      cache: 'no-store'
    });
    if (!res.ok) return;

    const cloud = await res.json();
    if (cloud && cloud.empty) {
      await pushCloudState();
      return;
    }

    if (cloud && typeof cloud.streakStartMs === 'number') {
      const merged = mergeStates(state, cloud);
      const isStreakChanged = merged.streakStartMs !== state.streakStartMs;
      const isLogsChanged = merged.logs.length !== state.logs.length;

      state = merged;
      saveLocalState();

      if (isStreakChanged || isLogsChanged) {
        renderLogs();
        updateUI(Date.now());
      }

      // Nếu local có logs chưa được lưu trên cloud, đẩy đồng bộ lên
      if (merged.logs.length > (cloud.logs || []).length || merged.updatedAt > (cloud.updatedAt || 0)) {
        await pushCloudState();
      }
    }
  } catch (err) {
  } finally {
    isSyncing = false;
  }
}

/**
 * Chuyển sang một người theo dõi khác
 */
function switchUser(newUser) {
  const clean = setActiveUser(newUser);
  currentUser = clean;
  headerUserName.textContent = clean;
  state = loadState(clean);
  renderLogs();
  updateUI(Date.now());
  closeUserModal();
  showToast(`Đã chuyển sang: ${clean}`);
  pullCloudState();
}

function openUserModal() {
  userNameInput.value = currentUser;
  renderRecentUsers();
  userModal.classList.remove('hidden');
  userNameInput.focus();
}

function closeUserModal() {
  userModal.classList.add('hidden');
}

function renderRecentUsers() {
  const recents = getRecentUsers();
  if (recents.length <= 1) {
    recentUsersSection.classList.add('hidden');
    return;
  }
  recentUsersSection.classList.remove('hidden');
  recentUsersList.innerHTML = recents
    .map((name) => {
      const isActive = name === currentUser ? 'active' : '';
      return `<button class="recent-user-tag ${isActive}" type="button" data-user="${name}">👤 ${name}</button>`;
    })
    .join('');

  recentUsersList.querySelectorAll('[data-user]').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchUser(btn.getAttribute('data-user'));
    });
  });
}

function computeMetrics(nowMs = Date.now()) {
  const todayKey = getLocalDateKey(nowMs);
  const cutoff30d = nowMs - THIRTY_DAYS_MS;

  let pastRecordMs = 0;
  let sumAwake30d = 0;
  let sumCigs30d = 0;
  let todayCigs = 0;
  let earliestTs = state.streakStartMs || nowMs;
  const activeDays = new Set();

  for (const item of state.logs) {
    if (item.eachIntervalMs > pastRecordMs) {
      pastRecordMs = item.eachIntervalMs;
    }
    if (item.timestamp >= cutoff30d) {
      sumAwake30d += item.totalAwakeMs;
      sumCigs30d += item.count;
      if (item.dateKey) activeDays.add(item.dateKey);
      if (item.timestamp < earliestTs) {
        earliestTs = item.timestamp;
      }
    }
    if (item.dateKey === todayKey) {
      todayCigs += item.count;
    }
  }

  const d = new Date(earliestTs);
  const startDateStr = `${d.getDate()}/${d.getMonth() + 1}`;

  const monthlyAvgMs = sumCigs30d > 0 ? Math.round(sumAwake30d / sumCigs30d) : 0;
  const numDays = Math.max(1, activeDays.size);
  const dailyAvgCigs = sumCigs30d > 0 ? (sumCigs30d / numDays).toFixed(1) : '0';

  return {
    pastRecordMs,
    monthlyAvgMs,
    sumCigs30d,
    dailyAvgCigs,
    todayCigs,
    startDateStr
  };
}

let modalRepeatTimer = null;
const MODAL_REMINDER_INTERVAL_MS = 5 * 60 * 1000; // 5 phút nhắc lại nếu chưa đóng

function playHourlyAlertSound() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([120, 80, 160]);
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Tiếng chuông "ting ting" (tinh tinh) vui tai: 2 nốt chuông trong trẻo (E6 -> B6)
    const chimes = [
      { freq: 1318.5, delay: 0.00, duration: 0.45 }, // Ting 1 (E6)
      { freq: 1975.5, delay: 0.16, duration: 0.70 }  // Ting 2 (B6)
    ];

    chimes.forEach(({ freq, delay, duration }) => {
      const startTime = ctx.currentTime + delay;

      // Nốt chính (sine tròn trịa)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Attack nhanh, decay ngân vang
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.24, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);

      // Hài âm cao nhẹ tạo độ trong suốt, leng keng vui tai
      const overtone = ctx.createOscillator();
      const overGain = ctx.createGain();
      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(freq * 2.0, startTime);
      overGain.gain.setValueAtTime(0.0001, startTime);
      overGain.gain.exponentialRampToValueAtTime(0.06, startTime + 0.012);
      overGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.6);

      overtone.connect(overGain);
      overGain.connect(ctx.destination);
      overtone.start(startTime);
      overtone.stop(startTime + duration * 0.6);
    });
  } catch (err) {}
}

function sendHourlyNotification(currentAwakeMs, metrics) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const title = `⏰ [${currentUser}] Đã duy trì ${formatShortDuration(currentAwakeMs)} không hút!`;
  const body = `Kỷ lục: ${formatShortDuration(metrics.pastRecordMs)} • TB: ${formatShortDuration(metrics.monthlyAvgMs)} • Hôm nay: ${metrics.todayCigs} điếu.`;

  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        body,
        icon: 'icon.svg',
        badge: 'icon.svg',
        tag: `smoff-${currentUser}`,
        renotify: true
      });
    });
  } else {
    const n = new Notification(title, { body, icon: 'icon.svg', tag: `smoff-${currentUser}` });
    n.onclick = () => {
      window.focus();
      openHourlyModal();
    };
  }
}

function openHourlyModal() {
  hourlyModal.classList.remove('hidden');
  updateUI(Date.now());
  playHourlyAlertSound();

  // Reset timer nhắc lại sau 5 phút nếu chưa đóng
  if (modalRepeatTimer) {
    clearInterval(modalRepeatTimer);
    modalRepeatTimer = null;
  }

  modalRepeatTimer = setInterval(() => {
    if (!hourlyModal.classList.contains('hidden')) {
      playHourlyAlertSound();
      const now = Date.now();
      let awakeMs = getAwakeDurationMs(state.streakStartMs, now);
      const metrics = calculateMetrics(now);
      sendHourlyNotification(awakeMs, metrics);
    } else {
      if (modalRepeatTimer) {
        clearInterval(modalRepeatTimer);
        modalRepeatTimer = null;
      }
    }
  }, MODAL_REMINDER_INTERVAL_MS);
}

function closeHourlyModal() {
  hourlyModal.classList.add('hidden');
  if (modalRepeatTimer) {
    clearInterval(modalRepeatTimer);
    modalRepeatTimer = null;
  }
}

function calculateIntervalAwakeMs(startMs, endMs, count) {
  let awakeMs = getAwakeDurationMs(startMs, endMs);
  const endInSleep = isSleepingTime(endMs);

  // Nếu hút ngoài giờ ngủ (23:00 - 07:30 VN): tính 1 tiếng cho mỗi điếu ngoài giờ vào lịch sử
  if (endInSleep) {
    awakeMs += count * ONE_HOUR_MS;
  }
  return awakeMs;
}

/**
 * Xử lý khi bấm nút hút (1, 2, 3) hoặc chưa hút (0)
 */
function handleSmokeButton(count) {
  const now = Date.now();

  if (count === 0) {
    state.lastCheckInMs = now;
    state.lastAlertedHourCycle = 0;
    closeHourlyModal();
    const currentAwakeMs = getAwakeDurationMs(state.streakStartMs, now);
    showToast(`Tiếp tục giữ chuỗi: ${formatShortDuration(currentAwakeMs)}`);
    updateUI(now);
    pushCloudState();
    return;
  }

  const totalAwakeMs = calculateIntervalAwakeMs(state.streakStartMs, now, count);
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
    showToast(`+1 điếu (${formatShortDuration(eachIntervalMs)})`);
  } else {
    showToast(`+${count} điếu (${formatShortDuration(eachIntervalMs)}/điếu)`);
  }
}

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
  showToast('↩ Đã hoàn tác');
}

function renderLogs() {
  const cutoff30d = Date.now() - THIRTY_DAYS_MS;
  const monthlyLogs = state.logs.filter((l) => l.timestamp >= cutoff30d);

  if (state.logs.length > 0) {
    btnUndo.classList.remove('hidden');
  } else {
    btnUndo.classList.add('hidden');
  }

  if (monthlyLogs.length === 0) {
    logList.innerHTML = `<div class="empty-log">Chưa có lần hút nào</div>`;
    return;
  }

  const metrics = computeMetrics(Date.now());
  const thresholdMs = metrics.monthlyAvgMs > 0 ? metrics.monthlyAvgMs : 2 * 3600 * 1000;
  const todayKey = getLocalDateKey(Date.now());

  logList.innerHTML = monthlyLogs
    .map((item) => {
      const isGood = item.eachIntervalMs >= thresholdMs;
      const durationText = item.count > 1
        ? `${formatShortDuration(item.eachIntervalMs)}/điếu × ${item.count}`
        : `${formatShortDuration(item.eachIntervalMs)}`;

      let timeLabel = formatTimeHHMM(item.timestamp);
      if (item.dateKey && item.dateKey !== todayKey) {
        const d = getVNDateParts(item.timestamp);
        timeLabel = `${d.date}/${d.month + 1} ${timeLabel}`;
      }

      return `
        <div class="log-item ${isGood ? 'bg-good' : 'bg-bad'}">
          <div class="log-left">
            <span class="log-pill">+${item.count}</span>
            <span class="log-duration ${isGood ? 'good' : 'bad'}">${durationText}</span>
          </div>
          <span class="log-right">${timeLabel}</span>
        </div>
      `;
    })
    .join('');
}

function updateUI(now = Date.now()) {
  const sleeping = isSleepingTime(now);

  if (sleeping) {
    statusDot.classList.add('sleeping');
    sleepBanner.classList.remove('hidden');
  } else {
    statusDot.classList.remove('sleeping');
    sleepBanner.classList.add('hidden');
  }

  const currentAwakeMs = getAwakeDurationMs(state.streakStartMs, now);
  currentStreakTimer.textContent = formatHMS(currentAwakeMs);

  const lastLog = state.logs[0];
  if (lastSmokeLabel) {
    if (lastLog) {
      lastSmokeLabel.textContent = `Lần cuối: ${formatTimeHHMM(lastLog.timestamp)}`;
    } else {
      lastSmokeLabel.textContent = `Bắt đầu: ${formatTimeHHMM(state.streakStartMs)}`;
    }
  }

  const metrics = computeMetrics(now);

  pastRecordValue.textContent = formatShortDuration(metrics.pastRecordMs);

  monthlyAvgValue.textContent = formatShortDuration(metrics.monthlyAvgMs);
  if (monthlyAvgSub) {
    monthlyAvgSub.textContent = `TB: ${metrics.dailyAvgCigs} điếu/ngày`;
  }

  todayCountValue.textContent = String(metrics.todayCigs);
  if (todayCountSub) {
    todayCountSub.textContent = `${metrics.sumCigs30d} điếu từ ${metrics.startDateStr}`;
  }

  if (metrics.pastRecordMs > 0 && currentAwakeMs > metrics.pastRecordMs) {
    liveRecordBadge.classList.remove('hidden');
  } else {
    liveRecordBadge.classList.add('hidden');
  }

  modalCurrentStreak.textContent = formatShortDuration(currentAwakeMs);
  modalPastRecord.textContent = formatShortDuration(metrics.pastRecordMs);
  modalMonthlyAvg.textContent = `${formatShortDuration(metrics.monthlyAvgMs)} (TB: ${metrics.dailyAvgCigs}/ngày)`;
  modalTodayCount.textContent = `${metrics.todayCigs} điếu (${metrics.sumCigs30d} điếu từ ${metrics.startDateStr})`;

  // Kiểm tra nổi popup sau mỗi 1 tiếng thức
  const awakeSinceCheckInMs = getAwakeDurationMs(state.lastCheckInMs, now);
  const currentHourCycle = Math.floor(awakeSinceCheckInMs / ONE_HOUR_MS);
  if (!sleeping && currentHourCycle >= 1 && currentHourCycle > state.lastAlertedHourCycle) {
    state.lastAlertedHourCycle = currentHourCycle;
    saveLocalState();
    openHourlyModal();
    sendHourlyNotification(currentAwakeMs, metrics);
  }
}

/**
 * Tự động yêu cầu quyền thông báo khi mở app / chạm màn hình
 */
function autoRequestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

// Event Listeners
document.querySelectorAll('[data-smoke]').forEach((btn) => {
  btn.addEventListener('click', () => {
    autoRequestNotificationPermission();
    const count = Number(btn.getAttribute('data-smoke'));
    handleSmokeButton(count);
  });
});

btnUndo.addEventListener('click', handleUndo);
btnTestPopup.addEventListener('click', () => {
  openHourlyModal();
});

btnUserModal.addEventListener('click', openUserModal);
btnCloseUserModal.addEventListener('click', closeUserModal);
userModal.addEventListener('click', (e) => {
  if (e.target === userModal) closeUserModal();
});

userForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const val = userNameInput.value.trim();
  if (val) {
    switchUser(val);
  }
});

// Tự bật thông báo khi tương tác
document.addEventListener('click', autoRequestNotificationPermission, { once: true });

// Service Worker
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

if (new URLSearchParams(window.location.search).get('prompt') === '1') {
  openHourlyModal();
}

// Khởi chạy
headerUserName.textContent = currentUser;
renderLogs();
updateUI(Date.now());
pullCloudState();
autoRequestNotificationPermission();

// Định kỳ đồng bộ
window.addEventListener('focus', () => pullCloudState());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    pullCloudState();
  }
});
setInterval(() => {
  pullCloudState();
}, 5000);

setInterval(() => {
  updateUI(Date.now());
}, 1000);
