package com.johnnyhoang.smoff

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            val prefs = SmoffPreferences(context)
            val nowMs = System.currentTimeMillis()
            val awakeSinceCheckIn = TimeService.getAwakeDurationMs(prefs.lastCheckInMs, nowMs)
            val neededAwakeMs = kotlin.math.max(
                5000L,
                TimeService.ONE_HOUR_MS - (awakeSinceCheckIn % TimeService.ONE_HOUR_MS)
            )
            NotificationHelper.scheduleHourlyAndSnoozeSequence(context, neededAwakeMs, prefs.isEnglish)
        }
    }
}
