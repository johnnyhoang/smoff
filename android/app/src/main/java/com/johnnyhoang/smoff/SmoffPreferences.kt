package com.johnnyhoang.smoff

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray

class SmoffPreferences(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("smoff_offline_prefs", Context.MODE_PRIVATE)

    var streakStartMs: Long
        get() = prefs.getLong("streakStartMs", System.currentTimeMillis())
        set(value) = prefs.edit().putLong("streakStartMs", value).apply()

    var lastCheckInMs: Long
        get() = prefs.getLong("lastCheckInMs", streakStartMs)
        set(value) = prefs.edit().putLong("lastCheckInMs", value).apply()

    var lastAlertedHourCycle: Int
        get() = prefs.getInt("lastAlertedHourCycle", 0)
        set(value) = prefs.edit().putInt("lastAlertedHourCycle", value).apply()

    var isEnglish: Boolean
        get() = prefs.getBoolean("isEnglish", false)
        set(value) = prefs.edit().putBoolean("isEnglish", value).apply()

    var themeMode: String
        get() = prefs.getString("themeMode", "dark") ?: "dark"
        set(value) = prefs.edit().putString("themeMode", value).apply()

    fun getLogs(): MutableList<SmokeLog> {
        val raw = prefs.getString("logs_json", "[]") ?: "[]"
        val list = mutableListOf<SmokeLog>()
        try {
            val arr = JSONArray(raw)
            for (i in 0 until arr.length()) {
                list.add(SmokeLog.fromJson(arr.getJSONObject(i)))
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return list
    }

    fun saveLogs(logs: List<SmokeLog>) {
        val arr = JSONArray()
        logs.take(1000).forEach { arr.put(it.toJson()) }
        prefs.edit().putString("logs_json", arr.toString()).apply()
    }
}
