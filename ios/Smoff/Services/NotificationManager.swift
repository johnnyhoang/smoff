import Foundation
import UserNotifications

final class NotificationManager: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationManager()
    
    private override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }

    /// Yêu cầu quyền thông báo nội bộ (Local Notification - không cần mạng/server)
    func requestPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            if granted {
                print("Local notifications granted")
            }
        }
    }

    /// Gửi thông báo 1 tiếng nhắc nhở
    func sendHourlyNotification(awakeDurationText: String, recordText: String, isEnglish: Bool = false) {
        let content = UNMutableNotificationContent()
        if isEnglish {
            content.title = "⏰ Kept clean for \(awakeDurationText)!"
            content.body = "Best: \(recordText). Keep the clean streak going!"
        } else {
            content.title = "⏰ Đã duy trì \(awakeDurationText) không hút!"
            content.body = "Kỷ lục: \(recordText). Hãy tiếp tục giữ chuỗi sạch nhé!"
        }
        content.sound = .default

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        let request = UNNotificationRequest(
            identifier: "smoff_hourly_\(Date().timeIntervalSince1970)",
            content: content,
            trigger: trigger
        )

        UNUserNotificationCenter.current().add(request)
    }

    /// Lên lịch chuỗi thông báo tự động khi app đóng/nằm nền:
    /// 1. Đúng mốc 1 tiếng thức -> Ting ting nhắc nhở
    /// 2. Nếu người dùng không mở app phản hồi -> Đúng 15 phút sau lại ting ting nhắc lại!
    /// 3. Nếu vẫn chưa mở -> 15 phút tiếp theo (30p) lại nhắc thêm 1 lần nữa!
    func scheduleHourlyAndSnoozeSequence(neededAwakeMs: Double, isEnglish: Bool = false) {
        cancelPendingHourlyNotifications()

        let now = Date()
        let targetDate = TimeService.calculateFutureDateForAwakeDuration(from: now, neededAwakeMs: neededAwakeMs)
        let delaySec = max(5.0, targetDate.timeIntervalSince(now))

        // 1. Mốc 1 tiếng chính
        let content1 = UNMutableNotificationContent()
        content1.title = isEnglish ? "⏰ 1 Hour Passed: Still smoke-free?" : "⏰ 1 tiếng vừa qua: Bạn có hút không?"
        content1.body = isEnglish ? "Open Smoff to check in and keep your clean streak going!" : "Mở Smoff điểm danh nhanh để tiếp tục giữ chuỗi nhé!"
        content1.sound = .default

        let trigger1 = UNTimeIntervalNotificationTrigger(timeInterval: delaySec, repeats: false)
        let request1 = UNNotificationRequest(
            identifier: "smoff_hourly_main",
            content: content1,
            trigger: trigger1
        )
        UNUserNotificationCenter.current().add(request1)

        // 2. Nhắc lại sau 15 phút nếu người dùng chưa phản hồi (Ting ting lần 2)
        let content2 = UNMutableNotificationContent()
        content2.title = isEnglish ? "⏰ 1h 15m Smoke-free check-in" : "⏰ Đã 1 tiếng 15 phút chưa hút thuốc!"
        content2.body = isEnglish ? "Are you still smoke-free? Tap to confirm and save your streak!" : "Bạn vẫn đang giữ chuỗi sạch chứ? Chạm vào để lưu chuỗi nhé!"
        content2.sound = .default

        let trigger2 = UNTimeIntervalNotificationTrigger(timeInterval: delaySec + (15 * 60), repeats: false)
        let request2 = UNNotificationRequest(
            identifier: "smoff_snooze_15m",
            content: content2,
            trigger: trigger2
        )
        UNUserNotificationCenter.current().add(request2)

        // 3. Nhắc lại sau 30 phút (15 phút tiếp theo) nếu vẫn chưa phản hồi
        let content3 = UNMutableNotificationContent()
        content3.title = isEnglish ? "⏰ Keep your clean streak going!" : "⏰ Tiếp tục giữ chuỗi sạch nhé!"
        content3.body = isEnglish ? "1 hour 30 mins clean! Don't let your streak slip away." : "Đã 1 tiếng 30 phút. Đừng quên ghi nhận để phá kỷ lục!"
        content3.sound = .default

        let trigger3 = UNTimeIntervalNotificationTrigger(timeInterval: delaySec + (30 * 60), repeats: false)
        let request3 = UNNotificationRequest(
            identifier: "smoff_snooze_30m",
            content: content3,
            trigger: trigger3
        )
        UNUserNotificationCenter.current().add(request3)
    }

    /// Hủy tất cả các nhắc nhở ngủ/chờ khi người dùng đã mở app và tương tác
    func cancelPendingHourlyNotifications() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [
            "smoff_hourly_main",
            "smoff_snooze_15m",
            "smoff_snooze_30m",
            "smoff_15min_snooze"
        ])
    }

    /// Khi app đang mở ở foreground nhưng user chưa bấm "Chưa hút", hẹn 15 phút sau nhắc lại
    func scheduleFifteenMinuteReminder(isEnglish: Bool = false) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["smoff_15min_snooze"])

        let content = UNMutableNotificationContent()
        if isEnglish {
            content.title = "⏰ 15 minutes since prompt: Did you smoke?"
            content.body = "Tap to check in quickly!"
        } else {
            content.title = "⏰ Đã 15 phút từ lúc nhắc: Bạn có hút không?"
            content.body = "Mở app và ghi nhận nhanh nhé!"
        }
        content.sound = .default

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 15 * 60, repeats: false)
        let request = UNNotificationRequest(
            identifier: "smoff_15min_snooze",
            content: content,
            trigger: trigger
        )

        UNUserNotificationCenter.current().add(request)
    }

    func cancelFifteenMinuteReminder() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["smoff_15min_snooze"])
    }

    // Hiển thị thông báo ngay cả khi app đang ở foreground
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound])
    }
}
