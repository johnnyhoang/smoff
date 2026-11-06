package com.johnnyhoang.smoff

import android.app.Application

class SmoffApp : Application() {
    override fun onCreate() {
        super.onCreate()
        NotificationHelper.createNotificationChannel(this)
    }
}
