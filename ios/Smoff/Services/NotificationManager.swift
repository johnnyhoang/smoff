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
    func sendHourlyNotification(awakeDurationText: String, recordText: String) {
        let content = UNMutableNotificationContent()
        content.title = "⏰ Đã duy trì \(awakeDurationText) không hút!"
        content.body = "Kỷ lục: \(recordText). Hãy tiếp tục giữ chuỗi sạch nhé!"
        content.sound = .default

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        let request = UNNotificationRequest(
            identifier: "smoff_hourly_\(Date().timeIntervalSince1970)",
            content: content,
            trigger: trigger
        )

        UNUserNotificationCenter.current().add(request)
    }

    /// Lên lịch nhắc lại sau 5 phút nếu người dùng chưa tương tác với popup
    func scheduleFiveMinuteReminder() {
        cancelFiveMinuteReminder()

        let content = UNMutableNotificationContent()
        content.title = "⏰ 1 tiếng vừa qua bạn có hút không?"
        content.body = "Mở app và ghi nhận nhanh nhé!"
        content.sound = .default

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 5 * 60, repeats: false)
        let request = UNNotificationRequest(
            identifier: "smoff_5min_snooze",
            content: content,
            trigger: trigger
        )

        UNUserNotificationCenter.current().add(request)
    }

    func cancelFiveMinuteReminder() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["smoff_5min_snooze"])
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
