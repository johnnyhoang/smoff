import Foundation
import SwiftUI
import Combine

final class SmoffStore: ObservableObject {
    @Published var streakStartMs: Double
    @Published var lastCheckInMs: Double
    @Published var logs: [SmokeLog]
    @Published var lastAlertedHourCycle: Int
    @Published var showHourlySheet: Bool = false
    @Published var isNewRecord: Bool = false
    @Published var isEnglish: Bool
    @Published var themeMode: SmoffThemeMode

    // Timer state
    @Published var currentAwakeMs: Double = 0
    @Published var isSleeping: Bool = false

    private let storageKey = "smoff_offline_state_v1"
    private let langKey = "smoff_is_english"
    private let themeKey = "smoff_theme_mode"
    private var timerSubscription: AnyCancellable?
    private var snoozeTimerSubscription: AnyCancellable?

    init() {
        self.isEnglish = UserDefaults.standard.bool(forKey: "smoff_is_english")
        let savedTheme = UserDefaults.standard.string(forKey: "smoff_theme_mode") ?? "dark"
        let initialTheme = SmoffThemeMode(rawValue: savedTheme) ?? .dark
        self.themeMode = initialTheme
        SmoffTheme.currentMode = initialTheme

        let now = Date().timeIntervalSince1970 * 1000
        if let data = UserDefaults.standard.data(forKey: storageKey),
           let saved = try? JSONDecoder().decode(SavedState.self, from: data) {
            self.streakStartMs = saved.streakStartMs
            self.lastCheckInMs = saved.lastCheckInMs
            self.logs = saved.logs
            self.lastAlertedHourCycle = saved.lastAlertedHourCycle
        } else {
            self.streakStartMs = now
            self.lastCheckInMs = now
            self.logs = []
            self.lastAlertedHourCycle = 0
        }

        updateTick()
        startTimer()
        scheduleNextBackgroundNotifications()
    }

    func startTimer() {
        timerSubscription = Timer.publish(every: 1.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.updateTick()
            }
    }

    func updateTick() {
        let now = Date()
        let nowMs = now.timeIntervalSince1970 * 1000
        self.isSleeping = TimeService.isSleepingTime(date: now)
        self.currentAwakeMs = TimeService.getAwakeDurationMs(startMs: streakStartMs, endMs: nowMs)

        let metrics = computeMetrics()
        self.isNewRecord = metrics.pastRecordMs > 0 && currentAwakeMs > metrics.pastRecordMs

        // Tự động bật popup sau mỗi 1 tiếng thức (ngoài giờ ngủ)
        let awakeSinceCheckIn = TimeService.getAwakeDurationMs(startMs: lastCheckInMs, endMs: nowMs)
        let cycle = Int(awakeSinceCheckIn / TimeService.oneHourMs)

        if !isSleeping && cycle >= 1 && cycle > lastAlertedHourCycle {
            lastAlertedHourCycle = cycle
            openHourlyPrompt()
            save()
        }
    }

    func toggleLanguage() {
        isEnglish.toggle()
        UserDefaults.standard.set(isEnglish, forKey: langKey)
        scheduleNextBackgroundNotifications()
    }

    func toggleTheme() {
        themeMode = themeMode.next
        SmoffTheme.currentMode = themeMode
        UserDefaults.standard.set(themeMode.rawValue, forKey: themeKey)
        HapticManager.shared.impact(.light)
    }

    func openHourlyPrompt() {
        showHourlySheet = true
        SoundManager.shared.playChime()
        NotificationManager.shared.scheduleFifteenMinuteReminder(isEnglish: isEnglish)

        let metrics = computeMetrics()
        NotificationManager.shared.sendHourlyNotification(
            awakeDurationText: TimeService.formatShortDuration(ms: currentAwakeMs, isEnglish: isEnglish),
            recordText: TimeService.formatShortDuration(ms: metrics.pastRecordMs, isEnglish: isEnglish),
            isEnglish: isEnglish
        )

        // Sau 15 phút nếu chưa đóng sheet thì lại ting ting tiếp
        snoozeTimerSubscription?.cancel()
        snoozeTimerSubscription = Timer.publish(every: 15 * 60, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self = self, self.showHourlySheet else { return }
                SoundManager.shared.playChime()
                NotificationManager.shared.scheduleFifteenMinuteReminder(isEnglish: self.isEnglish)
            }
    }

    func closeHourlyPrompt() {
        showHourlySheet = false
        snoozeTimerSubscription?.cancel()
        snoozeTimerSubscription = nil
        NotificationManager.shared.cancelFifteenMinuteReminder()
        scheduleNextBackgroundNotifications()
    }

    /// Lên lịch cho hệ thống iOS tự động đánh thức màn hình và phát chuông ting ting khi app đóng
    func scheduleNextBackgroundNotifications() {
        let nowMs = Date().timeIntervalSince1970 * 1000
        let awakeSinceCheckIn = TimeService.getAwakeDurationMs(startMs: lastCheckInMs, endMs: nowMs)
        let neededAwakeMs = max(5000, TimeService.oneHourMs - awakeSinceCheckIn.truncatingRemainder(dividingBy: TimeService.oneHourMs))
        NotificationManager.shared.scheduleHourlyAndSnoozeSequence(neededAwakeMs: neededAwakeMs, isEnglish: isEnglish)
    }

    func recordSmoke(count: Int) {
        let now = Date()
        let nowMs = now.timeIntervalSince1970 * 1000

        if count == 0 {
            // Chưa hút
            lastCheckInMs = nowMs
            lastAlertedHourCycle = 0
            closeHourlyPrompt()
            HapticManager.shared.impact(.light)
            save()
            return
        }

        var awakeMs = TimeService.getAwakeDurationMs(startMs: streakStartMs, endMs: nowMs)
        // Quy tắc: Nếu hút ngoài giờ ngủ (23:00 - 07:30), tính 1 tiếng cho mỗi điếu vào lịch sử
        if TimeService.isSleepingTime(date: now) {
            awakeMs += Double(count) * TimeService.oneHourMs
        }

        let newLog = SmokeLog(
            count: count,
            totalAwakeMs: awakeMs,
            dateKey: TimeService.getLocalDateKey(date: now),
            prevStreakStartMs: streakStartMs,
            prevCheckInMs: lastCheckInMs,
            timestamp: nowMs
        )

        logs.insert(newLog, at: 0)
        streakStartMs = nowMs
        lastCheckInMs = nowMs
        lastAlertedHourCycle = 0
        closeHourlyPrompt()
        HapticManager.shared.impact(.medium)
        save()
        updateTick()
    }

    func undo() {
        guard !logs.isEmpty else { return }
        let removed = logs.removeFirst()
        if let prevStart = removed.prevStreakStartMs {
            streakStartMs = prevStart
            lastCheckInMs = removed.prevCheckInMs ?? prevStart
        } else if let first = logs.first {
            streakStartMs = first.timestamp
            lastCheckInMs = first.timestamp
        }
        lastAlertedHourCycle = 0
        HapticManager.shared.impact(.light)
        save()
        updateTick()
        scheduleNextBackgroundNotifications()
    }

    struct Metrics {
        let pastRecordMs: Double
        let monthlyAvgMs: Double
        let dailyAvgCigs: String
        let todayCigs: Int
        let sumCigs30d: Int
        let startDateStr: String
    }

    func computeMetrics() -> Metrics {
        let nowMs = Date().timeIntervalSince1970 * 1000
        let todayKey = TimeService.getLocalDateKey()
        let cutoff30d = nowMs - TimeService.thirtyDaysMs

        var pastRecordMs: Double = 0
        var intervals30d: [Double] = []
        var sumCigs30d: Int = 0
        var todayCigs: Int = 0

        for log in logs {
            if log.dateKey == todayKey {
                todayCigs += log.count
            }
            if log.timestamp >= cutoff30d {
                sumCigs30d += log.count
                if log.count > 0 {
                    for _ in 0..<log.count {
                        intervals30d.append(log.eachIntervalMs)
                    }
                }
                if log.eachIntervalMs > pastRecordMs {
                    pastRecordMs = log.eachIntervalMs
                }
            }
        }

        let monthlyAvgMs: Double = intervals30d.isEmpty ? 0 : (intervals30d.reduce(0, +) / Double(intervals30d.count)).rounded()

        var earliestMs = nowMs
        for log in logs where log.timestamp >= cutoff30d {
            if log.timestamp < earliestMs { earliestMs = log.timestamp }
        }

        let daysActive = max(1.0, ((nowMs - earliestMs) / (24 * 3600 * 1000)).rounded(.up))
        let dailyAvgCigs = String(format: "%.1f", Double(sumCigs30d) / daysActive)

        let earliestDate = Date(timeIntervalSince1970: earliestMs / 1000)
        let calendar = Calendar.current
        let startD = calendar.component(.day, from: earliestDate)
        let startM = calendar.component(.month, from: earliestDate)
        let startDateStr = "\(startD)/\(startM)"

        return Metrics(
            pastRecordMs: pastRecordMs,
            monthlyAvgMs: monthlyAvgMs,
            dailyAvgCigs: dailyAvgCigs,
            todayCigs: todayCigs,
            sumCigs30d: sumCigs30d,
            startDateStr: startDateStr
        )
    }

    private func save() {
        let saved = SavedState(
            streakStartMs: streakStartMs,
            lastCheckInMs: lastCheckInMs,
            logs: logs,
            lastAlertedHourCycle: lastAlertedHourCycle
        )
        if let data = try? JSONEncoder().encode(saved) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
    }

    private struct SavedState: Codable {
        let streakStartMs: Double
        let lastCheckInMs: Double
        let logs: [SmokeLog]
        let lastAlertedHourCycle: Int
    }
}
