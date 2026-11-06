package com.johnnyhoang.smoff

import android.Manifest
import android.app.Dialog
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.widget.Button
import android.widget.LinearLayout
import android.widget.RelativeLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import java.util.Date
import kotlin.math.max

class MainActivity : AppCompatActivity() {

    private lateinit var prefs: SmoffPreferences

    // Views
    private lateinit var mainScrollView: ScrollView
    private lateinit var statusDot: View
    private lateinit var tvBrandTitle: TextView
    private lateinit var btnLangToggle: Button
    private lateinit var btnThemeToggle: Button
    private lateinit var sleepBanner: LinearLayout
    private lateinit var tvSleepTitle: TextView
    private lateinit var tvSleepStatus: TextView

    private lateinit var heroCard: LinearLayout
    private lateinit var tvHeroLabel: TextView
    private lateinit var tvStreakTimer: TextView
    private lateinit var badgeRecord: TextView

    private lateinit var statCard1: LinearLayout
    private lateinit var tvTitleRecord: TextView
    private lateinit var tvValueRecord: TextView

    private lateinit var statCard2: LinearLayout
    private lateinit var tvTitleAvg: TextView
    private lateinit var tvValueAvg: TextView
    private lateinit var tvSubAvg: TextView

    private lateinit var statCard3: LinearLayout
    private lateinit var tvTitleToday: TextView
    private lateinit var tvValueToday: TextView
    private lateinit var tvSubToday: TextView

    private lateinit var smokeActionsCard: LinearLayout
    private lateinit var btnSmoke1: Button
    private lateinit var btnSmoke2: Button
    private lateinit var btnSmoke3: Button

    private lateinit var historyCard: LinearLayout
    private lateinit var tvHistoryTitle: TextView
    private lateinit var btnUndo: TextView
    private lateinit var tvEmptyLog: TextView
    private lateinit var logContainer: LinearLayout

    // Timer loop
    private val handler = Handler(Looper.getMainLooper())
    private val timerRunnable = object : Runnable {
        override fun run() {
            updateTick()
            handler.postDelayed(this, 1000)
        }
    }

    private var activeModalDialog: Dialog? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = SmoffPreferences(this)

        setContentView(R.layout.activity_main)
        initViews()
        applyTheme(prefs.themeMode)
        applyLanguage(prefs.isEnglish)

        setupListeners()
        requestNotificationPermission()

        renderLogs()
        updateTick()
        scheduleNextBackgroundNotifications()

        if (intent.getBooleanExtra("open_modal", false)) {
            openHourlyModal()
        }
    }

    override fun onResume() {
        super.onResume()
        handler.post(timerRunnable)
        updateTick()
    }

    override fun onPause() {
        super.onPause()
        handler.removeCallbacks(timerRunnable)
        scheduleNextBackgroundNotifications()
    }

    private fun initViews() {
        mainScrollView = findViewById(R.id.mainScrollView)
        statusDot = findViewById(R.id.statusDot)
        tvBrandTitle = findViewById(R.id.tvBrandTitle)
        btnLangToggle = findViewById(R.id.btnLangToggle)
        btnThemeToggle = findViewById(R.id.btnThemeToggle)
        sleepBanner = findViewById(R.id.sleepBanner)
        tvSleepTitle = findViewById(R.id.tvSleepTitle)
        tvSleepStatus = findViewById(R.id.tvSleepStatus)

        heroCard = findViewById(R.id.heroCard)
        tvHeroLabel = findViewById(R.id.tvHeroLabel)
        tvStreakTimer = findViewById(R.id.tvStreakTimer)
        badgeRecord = findViewById(R.id.badgeRecord)

        statCard1 = findViewById(R.id.statCard1)
        tvTitleRecord = findViewById(R.id.tvTitleRecord)
        tvValueRecord = findViewById(R.id.tvValueRecord)

        statCard2 = findViewById(R.id.statCard2)
        tvTitleAvg = findViewById(R.id.tvTitleAvg)
        tvValueAvg = findViewById(R.id.tvValueAvg)
        tvSubAvg = findViewById(R.id.tvSubAvg)

        statCard3 = findViewById(R.id.statCard3)
        tvTitleToday = findViewById(R.id.tvTitleToday)
        tvValueToday = findViewById(R.id.tvValueToday)
        tvSubToday = findViewById(R.id.tvSubToday)

        smokeActionsCard = findViewById(R.id.smokeActionsCard)
        btnSmoke1 = findViewById(R.id.btnSmoke1)
        btnSmoke2 = findViewById(R.id.btnSmoke2)
        btnSmoke3 = findViewById(R.id.btnSmoke3)

        historyCard = findViewById(R.id.historyCard)
        tvHistoryTitle = findViewById(R.id.tvHistoryTitle)
        btnUndo = findViewById(R.id.btnUndo)
        tvEmptyLog = findViewById(R.id.tvEmptyLog)
        logContainer = findViewById(R.id.logContainer)
    }

    private fun setupListeners() {
        btnLangToggle.setOnClickListener {
            prefs.isEnglish = !prefs.isEnglish
            applyLanguage(prefs.isEnglish)
            renderLogs()
            updateTick()
            scheduleNextBackgroundNotifications()
        }

        btnThemeToggle.setOnClickListener {
            val nextTheme = when (prefs.themeMode) {
                "dark" -> "light"
                "light" -> "vibrant"
                else -> "dark"
            }
            prefs.themeMode = nextTheme
            applyTheme(nextTheme)
        }

        btnSmoke1.setOnClickListener { handleSmoke(1) }
        btnSmoke2.setOnClickListener { handleSmoke(2) }
        btnSmoke3.setOnClickListener { handleSmoke(3) }

        btnUndo.setOnClickListener { handleUndo() }
    }

    private fun handleSmoke(count: Int) {
        val now = System.currentTimeMillis()
        val en = prefs.isEnglish

        if (count == 0) {
            // Chưa hút
            prefs.lastCheckInMs = now
            prefs.lastAlertedHourCycle = 0
            activeModalDialog?.dismiss()
            val awake = TimeService.getAwakeDurationMs(prefs.streakStartMs, now)
            val msg = if (en) "Keep going: ${TimeService.formatShortDuration(awake, true)}" else "Tiếp tục giữ chuỗi: ${TimeService.formatShortDuration(awake, false)}"
            Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
            updateTick()
            scheduleNextBackgroundNotifications()
            return
        }

        var awake = TimeService.getAwakeDurationMs(prefs.streakStartMs, now)
        if (TimeService.isSleepingTime(now)) {
            awake += count * TimeService.ONE_HOUR_MS
        }

        val log = SmokeLog(
            count = count,
            totalAwakeMs = awake,
            dateKey = TimeService.getLocalDateKey(now),
            prevStreakStartMs = prefs.streakStartMs,
            prevCheckInMs = prefs.lastCheckInMs,
            timestamp = now
        )

        val logs = prefs.getLogs()
        logs.add(0, log)
        prefs.saveLogs(logs)

        prefs.streakStartMs = now
        prefs.lastCheckInMs = now
        prefs.lastAlertedHourCycle = 0

        activeModalDialog?.dismiss()
        renderLogs()
        updateTick()
        scheduleNextBackgroundNotifications()

        val eachDur = TimeService.formatShortDuration(log.eachIntervalMs, en)
        val msg = if (count == 1) {
            if (en) "+1 cigarette ($eachDur)" else "+1 điếu ($eachDur)"
        } else {
            if (en) "+$count cigarettes ($eachDur/cig)" else "+$count điếu ($eachDur/điếu)"
        }
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
    }

    private fun handleUndo() {
        val logs = prefs.getLogs()
        if (logs.isEmpty()) return
        val removed = logs.removeAt(0)
        prefs.saveLogs(logs)

        if (removed.prevStreakStartMs != null) {
            prefs.streakStartMs = removed.prevStreakStartMs
            prefs.lastCheckInMs = removed.prevCheckInMs ?: removed.prevStreakStartMs
        } else if (logs.isNotEmpty()) {
            prefs.streakStartMs = logs[0].timestamp
            prefs.lastCheckInMs = logs[0].timestamp
        }
        prefs.lastAlertedHourCycle = 0

        renderLogs()
        updateTick()
        scheduleNextBackgroundNotifications()
        Toast.makeText(this, if (prefs.isEnglish) "↩ Undone" else "↩ Đã hoàn tác", Toast.LENGTH_SHORT).show()
    }

    private fun updateTick() {
        val now = System.currentTimeMillis()
        val sleeping = TimeService.isSleepingTime(now)
        val en = prefs.isEnglish

        // Sleep indicator
        if (sleeping) {
            sleepBanner.visibility = View.VISIBLE
            statusDot.setBackgroundResource(R.drawable.shape_card_sleep)
        } else {
            sleepBanner.visibility = View.GONE
            statusDot.setBackgroundResource(R.drawable.shape_dot_emerald)
        }

        // Live timer
        val awakeMs = TimeService.getAwakeDurationMs(prefs.streakStartMs, now)
        tvStreakTimer.text = TimeService.formatHMS(awakeMs)

        // Metrics
        val metrics = computeMetrics(now)
        tvValueRecord.text = TimeService.formatShortDuration(metrics.pastRecordMs, en)
        tvValueAvg.text = TimeService.formatShortDuration(metrics.monthlyAvgMs, en)
        tvSubAvg.text = if (en) "Avg: ${metrics.dailyAvgCigs} cigs/day" else "TB: ${metrics.dailyAvgCigs} điếu/ngày"

        tvValueToday.text = "${metrics.todayCigs}"
        tvSubToday.text = if (en) "${metrics.sumCigs30d} cigs since ${metrics.startDateStr}" else "${metrics.sumCigs30d} điếu từ ${metrics.startDateStr}"

        // New record badge
        if (metrics.pastRecordMs > 0 && awakeMs > metrics.pastRecordMs) {
            badgeRecord.visibility = View.VISIBLE
        } else {
            badgeRecord.visibility = View.GONE
        }

        // Check for 1-hour awake check-in
        val awakeSinceCheckIn = TimeService.getAwakeDurationMs(prefs.lastCheckInMs, now)
        val cycle = (awakeSinceCheckIn / TimeService.ONE_HOUR_MS).toInt()
        if (!sleeping && cycle >= 1 && cycle > prefs.lastAlertedHourCycle) {
            prefs.lastAlertedHourCycle = cycle
            openHourlyModal()
            NotificationHelper.showHourlyNotification(
                this,
                if (en) "⏰ 1 Hour Passed: Still smoke-free?" else "⏰ 1 tiếng vừa qua: Bạn có hút không?",
                if (en) "Open Smoff to check in and keep your clean streak going!" else "Mở Smoff điểm danh nhanh để tiếp tục giữ chuỗi nhé!"
            )
        }
    }

    private fun openHourlyModal() {
        if (activeModalDialog?.isShowing == true) return

        val dialog = Dialog(this)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        dialog.setContentView(R.layout.dialog_hourly)
        dialog.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        dialog.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)

        val en = prefs.isEnglish
        val now = System.currentTimeMillis()
        val awakeMs = TimeService.getAwakeDurationMs(prefs.streakStartMs, now)
        val metrics = computeMetrics(now)

        dialog.findViewById<TextView>(R.id.dialogTitle).text = if (en) "Past 1 hour" else "1 tiếng vừa qua"
        dialog.findViewById<TextView>(R.id.dialogLabelStreak).text = if (en) "Clean streak" else "Đã nhịn"
        dialog.findViewById<TextView>(R.id.dialogValueStreak).text = TimeService.formatShortDuration(awakeMs, en)

        dialog.findViewById<TextView>(R.id.dialogLabelRecord).text = if (en) "Best streak" else "Nhịn dai nhất"
        dialog.findViewById<TextView>(R.id.dialogValueRecord).text = TimeService.formatShortDuration(metrics.pastRecordMs, en)

        dialog.findViewById<TextView>(R.id.dialogLabelAvg).text = if (en) "Average streak" else "Nhịn trung bình"
        dialog.findViewById<TextView>(R.id.dialogValueAvg).text = if (en) {
            "${TimeService.formatShortDuration(metrics.monthlyAvgMs, true)} (Avg: ${metrics.dailyAvgCigs}/day)"
        } else {
            "${TimeService.formatShortDuration(metrics.monthlyAvgMs, false)} (TB: ${metrics.dailyAvgCigs}/ngày)"
        }

        dialog.findViewById<TextView>(R.id.dialogLabelToday).text = if (en) "Smoked today" else "Hút hôm nay"
        dialog.findViewById<TextView>(R.id.dialogValueToday).text = if (en) {
            "${metrics.todayCigs} cigs (${metrics.sumCigs30d} cigs since ${metrics.startDateStr})"
        } else {
            "${metrics.todayCigs} điếu (${metrics.sumCigs30d} điếu từ ${metrics.startDateStr})"
        }

        dialog.findViewById<Button>(R.id.dialogBtnSmoke1).setOnClickListener {
            handleSmoke(1)
            dialog.dismiss()
        }
        dialog.findViewById<Button>(R.id.dialogBtnSmoke2).setOnClickListener {
            handleSmoke(2)
            dialog.dismiss()
        }
        dialog.findViewById<Button>(R.id.dialogBtnSmoke3).setOnClickListener {
            handleSmoke(3)
            dialog.dismiss()
        }

        val btnNoSmoke = dialog.findViewById<Button>(R.id.dialogBtnNoSmoke)
        btnNoSmoke.text = if (en) "Haven't smoked" else "Chưa hút"
        btnNoSmoke.setOnClickListener {
            handleSmoke(0)
            dialog.dismiss()
        }

        dialog.setOnDismissListener { activeModalDialog = null }
        activeModalDialog = dialog
        dialog.show()
    }

    private data class MetricsResult(
        val pastRecordMs: Long,
        val monthlyAvgMs: Long,
        val dailyAvgCigs: String,
        val todayCigs: Int,
        val sumCigs30d: Int,
        val startDateStr: String
    )

    private fun computeMetrics(nowMs: Long): MetricsResult {
        val todayKey = TimeService.getLocalDateKey(nowMs)
        val cutoff30d = nowMs - TimeService.THIRTY_DAYS_MS
        val logs = prefs.getLogs()

        var pastRecordMs = 0L
        val intervals30d = mutableListOf<Long>()
        var sumCigs30d = 0
        var todayCigs = 0
        var earliestMs = nowMs

        for (log in logs) {
            if (log.dateKey == todayKey) {
                todayCigs += log.count
            }
            if (log.timestamp >= cutoff30d) {
                sumCigs30d += log.count
                if (log.count > 0) {
                    repeat(log.count) { intervals30d.add(log.eachIntervalMs) }
                }
                if (log.eachIntervalMs > pastRecordMs) {
                    pastRecordMs = log.eachIntervalMs
                }
                if (log.timestamp < earliestMs) {
                    earliestMs = log.timestamp
                }
            }
        }

        val monthlyAvgMs = if (intervals30d.isEmpty()) 0L else (intervals30d.sum() / intervals30d.size)
        val daysActive = max(1.0, kotlin.math.ceil((nowMs - earliestMs) / (24.0 * 3600 * 1000)))
        val dailyAvgCigs = String.format(java.util.Locale.US, "%.1f", sumCigs30d / daysActive)

        val cal = java.util.Calendar.getInstance(TimeService.VN_TIMEZONE).apply { timeInMillis = earliestMs }
        val startDateStr = "${cal.get(java.util.Calendar.DAY_OF_MONTH)}/${cal.get(java.util.Calendar.MONTH) + 1}"

        return MetricsResult(
            pastRecordMs,
            monthlyAvgMs,
            dailyAvgCigs,
            todayCigs,
            sumCigs30d,
            startDateStr
        )
    }

    private fun renderLogs() {
        val logs = prefs.getLogs()
        val en = prefs.isEnglish
        val cutoff30d = System.currentTimeMillis() - TimeService.THIRTY_DAYS_MS
        val monthlyLogs = logs.filter { it.timestamp >= cutoff30d }

        btnUndo.visibility = if (logs.isNotEmpty()) View.VISIBLE else View.GONE
        logContainer.removeAllViews()

        if (monthlyLogs.isEmpty()) {
            tvEmptyLog.visibility = View.VISIBLE
            tvEmptyLog.text = if (en) "No logs yet" else "Chưa có lần hút nào"
            return
        }

        tvEmptyLog.visibility = View.GONE
        val metrics = computeMetrics(System.currentTimeMillis())
        val threshold = if (metrics.monthlyAvgMs > 0) metrics.monthlyAvgMs else (2 * 3600 * 1000L)
        val todayKey = TimeService.getLocalDateKey()

        for (item in monthlyLogs) {
            val isGood = item.eachIntervalMs >= threshold
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(12), dp(8), dp(12), dp(8))
                val bg = GradientDrawable().apply {
                    cornerRadius = dp(14).toFloat()
                    setColor(if (isGood) Color.parseColor("#1410B981") else Color.parseColor("#14EF4444"))
                    setStroke(dp(1), if (isGood) Color.parseColor("#3310B981") else Color.parseColor("#33EF4444"))
                }
                background = bg
                val lp = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                    setMargins(0, 0, 0, dp(6))
                }
                layoutParams = lp
            }

            // Pill count
            val pill = TextView(this).apply {
                text = "+${item.count}"
                setTextColor(if (isGood) Color.parseColor("#10B981") else Color.parseColor("#EF4444"))
                textSize = 12f
                typeface = android.graphics.Typeface.DEFAULT_BOLD
                setPadding(dp(8), dp(2), dp(8), dp(2))
                background = GradientDrawable().apply {
                    cornerRadius = dp(999).toFloat()
                    setColor(if (isGood) Color.parseColor("#2910B981") else Color.parseColor("#29EF4444"))
                }
            }
            row.addView(pill)

            // Duration text
            val perUnit = if (en) "/cig" else "/điếu"
            val durText = if (item.count > 1) {
                "${TimeService.formatShortDuration(item.eachIntervalMs, en)}$perUnit × ${item.count}"
            } else {
                TimeService.formatShortDuration(item.eachIntervalMs, en)
            }

            val tvDur = TextView(this).apply {
                text = durText
                setTextColor(if (isGood) Color.parseColor("#10B981") else Color.parseColor("#EF4444"))
                textSize = 13.5f
                typeface = android.graphics.Typeface.DEFAULT_BOLD
                setPadding(dp(8), 0, 0, 0)
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            }
            row.addView(tvDur)

            // Time label
            var timeLabel = TimeService.formatTimeHHMM(item.timestamp)
            if (item.dateKey != todayKey) {
                val cal = java.util.Calendar.getInstance(TimeService.VN_TIMEZONE).apply { timeInMillis = item.timestamp }
                timeLabel = "${cal.get(java.util.Calendar.DAY_OF_MONTH)}/${cal.get(java.util.Calendar.MONTH) + 1} $timeLabel"
            }

            val tvTime = TextView(this).apply {
                text = timeLabel
                setTextColor(Color.parseColor("#94A3B8"))
                textSize = 12f
            }
            row.addView(tvTime)

            logContainer.addView(row)
        }
    }

    private fun scheduleNextBackgroundNotifications() {
        val now = System.currentTimeMillis()
        val awakeSince = TimeService.getAwakeDurationMs(prefs.lastCheckInMs, now)
        val needed = max(5000L, TimeService.ONE_HOUR_MS - (awakeSince % TimeService.ONE_HOUR_MS))
        NotificationHelper.scheduleHourlyAndSnoozeSequence(this, needed, prefs.isEnglish)
    }

    private fun applyLanguage(isEnglish: Boolean) {
        btnLangToggle.text = if (isEnglish) "VI" else "EN"
        tvSleepTitle.text = if (isEnglish) "🌙 Sleep hours (23:00–07:30)" else "🌙 Giờ ngủ (23:00–07:30)"
        tvSleepStatus.text = if (isEnglish) "Paused" else "Tạm dừng"
        tvHeroLabel.text = if (isEnglish) "CLEAN STREAK" else "ĐÃ NHỊN"
        badgeRecord.text = if (isEnglish) "🔥 New record!" else "🔥 Kỷ lục mới!"
        tvTitleRecord.text = if (isEnglish) "Best streak" else "Nhịn dai nhất"
        tvTitleAvg.text = if (isEnglish) "Average streak" else "Nhịn trung bình"
        tvTitleToday.text = if (isEnglish) "Smoked today" else "Hút hôm nay"
        tvHistoryTitle.text = if (isEnglish) "History" else "Lịch sử"
        btnUndo.text = if (isEnglish) "↩ Undo" else "↩ Hoàn tác"
    }

    private fun applyTheme(mode: String) {
        val (bgColor, cardColor, borderColor, textCol, mutedCol) = when (mode) {
            "light" -> listOf("#F1F5F9", "#FFFFFF", "#E2E8F0", "#0F172A", "#64748B")
            "vibrant" -> listOf("#0D0722", "#1C1035", "#EC4899", "#FFFFFF", "#C4B5FD")
            else -> listOf("#0B0F19", "#111827", "#1F2937", "#F8FAFC", "#94A3B8")
        }

        btnThemeToggle.text = when (mode) {
            "light" -> "☀️"
            "vibrant" -> "🎨"
            else -> "🌙"
        }

        mainScrollView.setBackgroundColor(Color.parseColor(bgColor))
        window.statusBarColor = Color.parseColor(bgColor)
        window.navigationBarColor = Color.parseColor(bgColor)

        val cardBg = GradientDrawable().apply {
            cornerRadius = dp(20).toFloat()
            setColor(Color.parseColor(cardColor))
            setStroke(dp(1), Color.parseColor(borderColor))
        }

        heroCard.background = cardBg
        statCard1.background = cardBg.constantState?.newDrawable()
        statCard2.background = cardBg.constantState?.newDrawable()
        statCard3.background = cardBg.constantState?.newDrawable()
        smokeActionsCard.background = cardBg.constantState?.newDrawable()
        historyCard.background = cardBg.constantState?.newDrawable()

        tvBrandTitle.setTextColor(Color.parseColor(textCol))
        tvStreakTimer.setTextColor(Color.parseColor(textCol))
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 101)
            }
        }
    }

    private fun dp(dp: Int): Int = (dp * resources.displayMetrics.density).toInt()
}
