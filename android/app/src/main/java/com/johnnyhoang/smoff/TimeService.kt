package com.johnnyhoang.smoff

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.math.max

object TimeService {
    val VN_TIMEZONE: TimeZone = TimeZone.getTimeZone("Asia/Ho_Chi_Minh")
    const val ONE_HOUR_MS = 60 * 60 * 1000L
    const val THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000L

    private fun getVNCalendar(timeMs: Long = System.currentTimeMillis()): Calendar {
        val cal = Calendar.getInstance(VN_TIMEZONE)
        cal.timeInMillis = timeMs
        return cal
    }

    /**
     * Kiểm tra thời điểm có nằm trong khung giờ ngủ (23:00 - 07:30 VN) hay không
     */
    fun isSleepingTime(timeMs: Long = System.currentTimeMillis()): Boolean {
        val cal = getVNCalendar(timeMs)
        val hour = cal.get(Calendar.HOUR_OF_DAY)
        val minute = cal.get(Calendar.MINUTE)

        if (hour == 23) return true
        if (hour < 7 || (hour == 7 && minute < 30)) return true
        return false
    }

    /**
     * Tính chính xác tổng thời gian THỨC (đã loại trừ 23:00 - 07:30 mỗi ngày theo giờ VN)
     */
    fun getAwakeDurationMs(startMs: Long, endMs: Long): Long {
        if (startMs <= 0 || endMs <= startMs) return 0L

        val startCal = getVNCalendar(startMs).apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        val endCal = getVNCalendar(endMs).apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        var totalAwakeMs = 0L
        val cursor = startCal.clone() as Calendar

        while (!cursor.after(endCal)) {
            val midnightMs = cursor.timeInMillis
            val awakeStart = midnightMs + (7 * 3600 + 30 * 60) * 1000L // 07:30
            val awakeEnd = midnightMs + 23 * 3600 * 1000L              // 23:00

            val overlapStart = max(startMs, awakeStart)
            val overlapEnd = kotlin.math.min(endMs, awakeEnd)

            if (overlapEnd > overlapStart) {
                totalAwakeMs += (overlapEnd - overlapStart)
            }

            cursor.add(Calendar.DAY_OF_YEAR, 1)
        }

        return totalAwakeMs
    }

    /**
     * Tính thời điểm trong tương lai (Epoch ms) khi người dùng đạt thêm `neededAwakeMs` thời gian THỨC
     */
    fun calculateFutureDateForAwakeDuration(fromMs: Long = System.currentTimeMillis(), neededAwakeMs: Long): Long {
        if (neededAwakeMs <= 0L) return fromMs

        var remainingMs = neededAwakeMs
        var cursorMs = fromMs

        while (remainingMs > 0) {
            val cal = getVNCalendar(cursorMs)
            val hour = cal.get(Calendar.HOUR_OF_DAY)

            if (isSleepingTime(cursorMs)) {
                cal.set(Calendar.HOUR_OF_DAY, 7)
                cal.set(Calendar.MINUTE, 30)
                cal.set(Calendar.SECOND, 0)
                cal.set(Calendar.MILLISECOND, 0)
                if (hour == 23) {
                    cal.add(Calendar.DAY_OF_YEAR, 1)
                }
                cursorMs = cal.timeInMillis
                continue
            }

            // Đang trong giờ thức
            val sleepStartCal = cal.clone() as Calendar
            sleepStartCal.set(Calendar.HOUR_OF_DAY, 23)
            sleepStartCal.set(Calendar.MINUTE, 0)
            sleepStartCal.set(Calendar.SECOND, 0)
            sleepStartCal.set(Calendar.MILLISECOND, 0)

            val msUntilSleep = sleepStartCal.timeInMillis - cursorMs
            if (remainingMs <= msUntilSleep) {
                return cursorMs + remainingMs
            } else {
                remainingMs -= msUntilSleep
                sleepStartCal.add(Calendar.DAY_OF_YEAR, 1)
                sleepStartCal.set(Calendar.HOUR_OF_DAY, 7)
                sleepStartCal.set(Calendar.MINUTE, 30)
                cursorMs = sleepStartCal.timeInMillis
            }
        }

        return cursorMs
    }

    fun getLocalDateKey(timeMs: Long = System.currentTimeMillis()): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { timeZone = VN_TIMEZONE }
        return sdf.format(Date(timeMs))
    }

    fun formatTimeHHMM(timeMs: Long): String {
        val sdf = SimpleDateFormat("HH:mm", Locale.US).apply { timeZone = VN_TIMEZONE }
        return sdf.format(Date(timeMs))
    }

    fun formatHMS(ms: Long): String {
        val totalSec = max(0L, ms / 1000L)
        val h = totalSec / 3600L
        val m = (totalSec % 3600L) / 60L
        val s = totalSec % 60L
        return String.format(Locale.US, "%02d:%02d:%02d", h, m, s)
    }

    fun formatShortDuration(ms: Long, isEnglish: Boolean = false): String {
        if (ms <= 0L) return if (isEnglish) "0m" else "0p"
        val totalSec = (ms / 1000.0).toLong()
        val h = totalSec / 3600L
        val m = (totalSec % 3600L) / 60L
        val s = totalSec % 60L

        val mUnit = if (isEnglish) "m" else "p"
        val hUnit = "h"
        val sUnit = "s"

        return when {
            h > 0L -> String.format(Locale.US, "%d%s %02d%s", h, hUnit, m, mUnit)
            m > 0L -> if (s > 0L && m < 10L) "$m$mUnit $s$sUnit" else "$m$mUnit"
            else -> "$s$sUnit"
        }
    }
}
