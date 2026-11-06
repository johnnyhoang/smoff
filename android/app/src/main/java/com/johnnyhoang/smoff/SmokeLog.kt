package com.johnnyhoang.smoff

import org.json.JSONObject

data class SmokeLog(
    val id: String = "${System.currentTimeMillis()}-${(1000..9999).random()}",
    val timestamp: Long = System.currentTimeMillis(),
    val count: Int,
    val totalAwakeMs: Long,
    val eachIntervalMs: Long = if (count > 0) totalAwakeMs / count else totalAwakeMs,
    val dateKey: String,
    val prevStreakStartMs: Long? = null,
    val prevCheckInMs: Long? = null
) {
    fun toJson(): JSONObject {
        return JSONObject().apply {
            put("id", id)
            put("timestamp", timestamp)
            put("count", count)
            put("totalAwakeMs", totalAwakeMs)
            put("eachIntervalMs", eachIntervalMs)
            put("dateKey", dateKey)
            if (prevStreakStartMs != null) put("prevStreakStartMs", prevStreakStartMs)
            if (prevCheckInMs != null) put("prevCheckInMs", prevCheckInMs)
        }
    }

    companion object {
        fun fromJson(json: JSONObject): SmokeLog {
            val count = json.optInt("count", 1)
            val totalAwakeMs = json.optLong("totalAwakeMs", 0L)
            val each = json.optLong("eachIntervalMs", if (count > 0) totalAwakeMs / count else totalAwakeMs)
            return SmokeLog(
                id = json.optString("id", "${System.currentTimeMillis()}"),
                timestamp = json.optLong("timestamp", System.currentTimeMillis()),
                count = count,
                totalAwakeMs = totalAwakeMs,
                eachIntervalMs = each,
                dateKey = json.optString("dateKey", ""),
                prevStreakStartMs = if (json.has("prevStreakStartMs")) json.optLong("prevStreakStartMs") else null,
                prevCheckInMs = if (json.has("prevCheckInMs")) json.optLong("prevCheckInMs") else null
            )
        }
    }
}
