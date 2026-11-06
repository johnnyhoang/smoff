package com.johnnyhoang.smoff

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val title = intent.getStringExtra("title") ?: "⏰ 1 tiếng vừa qua"
        val body = intent.getStringExtra("body") ?: "Mở Smoff ghi nhận điểm danh nhé!"
        NotificationHelper.showHourlyNotification(context, title, body)
    }
}
