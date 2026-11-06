import Foundation
import UIKit
import AudioToolbox
import AVFoundation

final class HapticManager {
    static let shared = HapticManager()
    private init() {}

    func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .medium) {
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.prepare()
        generator.impactOccurred()
    }

    func notify(_ type: UINotificationFeedbackGenerator.FeedbackType = .success) {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(type)
    }
}

final class SoundManager {
    static let shared = SoundManager()
    private var audioEngine: AVAudioEngine?
    
    private init() {}

    /// Phát tiếng chuông "ting ting" (tinh tinh) vui tai khi nổi popup nhắc nhở
    func playChime() {
        // Rung nhịp đôi vui tai
        HapticManager.shared.notify(.success)

        // Phát âm thanh chuông hệ thống iOS trong trẻo (SMS Received / Tink)
        AudioServicesPlaySystemSound(1057) // Crisp Apple Tink Chime
        
        // Nhịp ting thứ 2 sau 160ms
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.16) {
            AudioServicesPlaySystemSound(1052) // Ping chime
        }
    }
}
