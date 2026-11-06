package com.johnnyhoang.smoff

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

object NotificationHelper {
    const val CHANNEL_ID = "smoff_hourly_channel"
    const val NOTIF_ID_HOURLY = 1001

    const val REQ_CODE_MAIN = 2001
    const val REQ_CODE_SNOOZE_15M = 2002
    const val REQ_CODE_SNOOZE_30M = 2003

    fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = context.getString(R.string.channel_name)
            val descriptionText = context.getString(R.string.channel_desc)
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 150, 100, 200)
                setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), null)
            }
            val notificationManager: NotificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun showHourlyNotification(context: Context, title: String, body: String) {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("open_modal", true)
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setSound(soundUri)
            .setVibrate(longArrayOf(0, 150, 100, 200))
            .setContentIntent(pendingIntent)

        val manager = NotificationManagerCompat.from(context)
        try {
            manager.notify(NOTIF_ID_HOURLY, builder.build())
        } catch (e: SecurityException) {
            e.printStackTrace()
        }
    }

    /**
     * Lên lịch chuỗi nhắc nhở bằng AlarmManager:
     * 1. Đúng 1 tiếng thức -> Ting ting (Main)
     * 2. Nếu không hồi đáp -> Sau 15 phút ting ting lần 2 (Snooze 15m)
     * 3. Nếu vẫn không hồi đáp -> Sau 30 phút ting ting lần 3 (Snooze 30m)
     */
    fun scheduleHourlyAndSnoozeSequence(context: Context, neededAwakeMs: Long, isEnglish: Boolean) {
        cancelPendingAlarms(context)

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val now = System.currentTimeMillis()
        val targetMainMs = TimeService.calculateFutureDateForAwakeDuration(now, neededAwakeMs)

        // 1. Mốc 1 tiếng chính
        scheduleSingleAlarm(
            context,
            alarmManager,
            REQ_CODE_MAIN,
            targetMainMs,
            if (isEnglish) "⏰ 1 Hour Passed: Still smoke-free?" else "⏰ 1 tiếng vừa qua: Bạn có hút không?",
            if (isEnglish) "Open Smoff to check in and keep your clean streak going!" else "Mở Smoff điểm danh nhanh để tiếp tục giữ chuỗi nhé!"
        )

        // 2. Nhắc lại sau 15 phút nếu người dùng chưa mở app
        scheduleSingleAlarm(
            context,
            alarmManager,
            REQ_CODE_SNOOZE_15M,
            targetMainMs + (15 * 60 * 1000L),
            if (isEnglish) "⏰ 1h 15m Smoke-free check-in" else "⏰ Đã 1 tiếng 15 phút chưa hút thuốc!",
            if (isEnglish) "Are you still smoke-free? Tap to confirm and save your streak!" else "Bạn vẫn đang giữ chuỗi sạch chứ? Chạm vào để lưu chuỗi nhé!"
        )

        // 3. Nhắc lại sau 30 phút (15 phút tiếp theo)
        scheduleSingleAlarm(
            context,
            alarmManager,
            REQ_CODE_SNOOZE_30M,
            targetMainMs + (30 * 60 * 1000L),
            if (isEnglish) "⏰ Keep your clean streak going!" else "⏰ Tiếp tục giữ chuỗi sạch nhé!",
            if (isEnglish) "1 hour 30 mins clean! Don't let your streak slip away." else "Đã 1 tiếng 30 phút. Đừng quên ghi nhận để phá kỷ lục!"
        )
    }

    private fun scheduleSingleAlarm(
        context: Context,
        alarmManager: AlarmManager,
        requestCode: Int,
        triggerAtMs: Long,
        title: String,
        body: String
    ) {
        val intent = Intent(context, AlarmReceiver::class.java).apply {
            putExtra("title", title)
            putExtra("body", body)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pendingIntent)
        } else {
            alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMs, pendingIntent)
        }
    }

    fun cancelPendingAlarms(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        listOf(REQ_CODE_MAIN, REQ_CODE_SNOOZE_15M, REQ_CODE_SNOOZE_30M).forEach { reqCode ->
            val intent = Intent(context, AlarmReceiver::class.java)
            val pi = PendingIntent.getBroadcast(
                context,
                reqCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager.cancel(pi)
        }
    }
}
