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

    /// Tính chính xác thời điểm trong tương lai khi đạt thêm `neededAwakeMs` thời gian THỨC (đã tự động né khung ngủ 23:00 - 07:30)
    static func calculateFutureDateForAwakeDuration(from startDate: Date = Date(), neededAwakeMs: Double, calendar: Calendar = .current) -> Date {
        guard neededAwakeMs > 0 else { return startDate }

        var remainingMs = neededAwakeMs
        var cursor = startDate

        while remainingMs > 0 {
            let hour = calendar.component(.hour, from: cursor)

            // Nếu cursor đang trong giờ ngủ (23:00 - 07:30)
            if isSleepingTime(date: cursor, calendar: calendar) {
                var comp = calendar.dateComponents([.year, .month, .day], from: cursor)
                if hour == 23 {
                    if let nextDay = calendar.date(byAdding: .day, value: 1, to: cursor) {
                        comp = calendar.dateComponents([.year, .month, .day], from: nextDay)
                    }
                }
                comp.hour = 7
                comp.minute = 30
                comp.second = 0
                if let nextMorning = calendar.date(from: comp) {
                    cursor = nextMorning
                    continue
                }
            }

            // Đang trong giờ thức: Tính thời gian còn lại đến 23:00
            var comp = calendar.dateComponents([.year, .month, .day], from: cursor)
            comp.hour = 23
            comp.minute = 0
            comp.second = 0
            guard let sleepStart = calendar.date(from: comp) else { break }

            let msUntilSleep = sleepStart.timeIntervalSince(cursor) * 1000
            if remainingMs <= msUntilSleep {
                return cursor.addingTimeInterval(remainingMs / 1000)
            } else {
                remainingMs -= msUntilSleep
                if let nextDay = calendar.date(byAdding: .day, value: 1, to: cursor) {
                    var nextAwakeComp = calendar.dateComponents([.year, .month, .day], from: nextDay)
                    nextAwakeComp.hour = 7
                    nextAwakeComp.minute = 30
                    nextAwakeComp.second = 0
                    if let nextMorning = calendar.date(from: nextAwakeComp) {
                        cursor = nextMorning
                    }
                }
            }
        }
        return cursor
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

    static func formatShortDuration(ms: Double, isEnglish: Bool = false) -> String {
        guard ms > 0 else { return isEnglish ? "0m" : "0p" }
        let totalSec = Int((ms / 1000).rounded())
        let h = totalSec / 3600
        let m = (totalSec % 3600) / 60
        let s = totalSec % 60

        let mUnit = isEnglish ? "m" : "p"
        let hUnit = "h"
        let sUnit = "s"

        if h > 0 {
            return String(format: "%d%@ %02d%@", h, hUnit, m, mUnit)
        }
        if m > 0 {
            return (s > 0 && m < 10) ? "\(m)\(mUnit) \(s)\(sUnit)" : "\(m)\(mUnit)"
        }
        return "\(s)\(sUnit)"
    }

    static func formatTimeHHMM(date: Date, calendar: Calendar = .current) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }
}
