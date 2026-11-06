import SwiftUI

enum SmoffTheme {
    static let background = Color(hex: "0B0F19")
    static let cardBackground = Color(hex: "111827")
    static let cardBorder = Color.white.opacity(0.08)
    
    static let textPrimary = Color.white
    static let textMuted = Color(hex: "94A3B8")
    
    static let emerald = Color(hex: "10B981")
    static let emeraldBg = Color(hex: "10B981").opacity(0.16)
    
    static let sky = Color(hex: "38BDF8")
    static let skyBg = Color(hex: "38BDF8").opacity(0.16)
    
    static let amber = Color(hex: "FBBF24")
    static let amberBg = Color(hex: "FBBF24").opacity(0.16)
    
    static let orange = Color(hex: "FB923C")
    static let orangeBg = Color(hex: "FB923C").opacity(0.16)
    
    static let red = Color(hex: "EF4444")
    static let redBg = Color(hex: "EF4444").opacity(0.16)
    
    static let sleepPurple = Color(hex: "818CF8")
    static let sleepBg = Color(hex: "312E81").opacity(0.4)
}

extension Color {
    init(hex: String) {
        let scanner = Scanner(string: hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted))
        var int: UInt64 = 0
        scanner.scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
