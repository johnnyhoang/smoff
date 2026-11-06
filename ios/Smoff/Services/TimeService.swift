import Foundation

struct TimeService {
    static let oneHourMs: Double = 60 * 60 * 1000
    static let thirtyDaysMs: Double = 30 * 24 * 60 * 60 * 1000

    /// Kiểm tra thời điểm có nằm trong khung giờ ngủ (23:00 - 07:30) hay không
    static func isSleepingTime(date: Date = Date(), calendar: Calendar = .current) -> Bool {
        let hour = calendar.component(.hour, from: date)
        let minute = calendar.component(.minute, from: date)
        if hour == 23 { return true }
        if hour < 7 || (hour == 7 && minute < 30) { return true }
        return false
    }

    /// Tính tổng thời gian THỨC giữa hai mốc (loại trừ khung ngủ 23:00 - 07:30 mỗi ngày)
    static func getAwakeDurationMs(startMs: Double, endMs: Double, calendar: Calendar = .current) -> Double {
        guard startMs > 0, endMs > startMs else { return 0 }

        let startDate = Date(timeIntervalSince1970: startMs / 1000)
        let endDate = Date(timeIntervalSince1970: endMs / 1000)

        var cursor = calendar.startOfDay(for: startDate)
        let endMidnight = calendar.startOfDay(for: endDate)

        var totalAwakeMs: Double = 0

        while cursor <= endMidnight {
            var components = calendar.dateComponents([.year, .month, .day], from: cursor)

            // Khung thức: 07:30:00 -> 23:00:00
            components.hour = 7
            components.minute = 30
            components.second = 0
            guard let awakeStart = calendar.date(from: components) else { break }

            components.hour = 23
            components.minute = 0
            components.second = 0
            guard let awakeEnd = calendar.date(from: components) else { break }

            let awakeStartMs = awakeStart.timeIntervalSince1970 * 1000
            let awakeEndMs = awakeEnd.timeIntervalSince1970 * 1000

            let overlapStart = max(startMs, awakeStartMs)
            let overlapEnd = min(endMs, awakeEndMs)

            if overlapEnd > overlapStart {
                totalAwakeMs += (overlapEnd - overlapStart)
            }

            guard let nextDay = calendar.date(byAdding: .day, value: 1, to: cursor) else { break }
            cursor = nextDay
        }

        return totalAwakeMs
    }

    static func getLocalDateKey(date: Date = Date(), calendar: Calendar = .current) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    static func formatHMS(ms: Double) -> String {
        let totalSec = max(0, Int(ms / 1000))
        let h = totalSec / 3600
        let m = (totalSec % 3600) / 60
        let s = totalSec % 60
        return String(format: "%02d:%02d:%02d", h, m, s)
    }

    static func formatShortDuration(ms: Double) -> String {
        guard ms > 0 else { return "0p" }
        let totalSec = Int((ms / 1000).rounded())
        let h = totalSec / 3600
        let m = (totalSec % 3600) / 60
        let s = totalSec % 60

        if h > 0 {
            return String(format: "%dh %02dp", h, m)
        }
        if m > 0 {
            return (s > 0 && m < 10) ? "\(m)p \(s)s" : "\(m)p"
        }
        return "\(s)s"
    }

    static func formatTimeHHMM(date: Date, calendar: Calendar = .current) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }
}
