import SwiftUI

enum SmoffThemeMode: String, CaseIterable, Codable {
    case dark
    case light
    case vibrant

    var next: SmoffThemeMode {
        switch self {
        case .dark: return .light
        case .light: return .vibrant
        case .vibrant: return .dark
        }
    }

    var icon: String {
        switch self {
        case .dark: return "🌙"
        case .light: return "☀️"
        case .vibrant: return "🎨"
        }
    }
}

struct ThemeColors {
    let background: Color
    let cardBackground: Color
    let cardBorder: Color
    let textPrimary: Color
    let textMuted: Color
    let emerald: Color
    let emeraldBg: Color
    let sky: Color
    let skyBg: Color
    let amber: Color
    let amberBg: Color
    let orange: Color
    let orangeBg: Color
    let red: Color
    let redBg: Color
    let sleepPurple: Color
    let sleepBg: Color
}

enum SmoffTheme {
    static var currentMode: SmoffThemeMode = .dark

    static func colors(for mode: SmoffThemeMode) -> ThemeColors {
        switch mode {
        case .dark:
            return ThemeColors(
                background: Color(hex: "0B0F19"),
                cardBackground: Color(hex: "111827"),
                cardBorder: Color.white.opacity(0.08),
                textPrimary: Color.white,
                textMuted: Color(hex: "94A3B8"),
                emerald: Color(hex: "10B981"),
                emeraldBg: Color(hex: "10B981").opacity(0.16),
                sky: Color(hex: "38BDF8"),
                skyBg: Color(hex: "38BDF8").opacity(0.16),
                amber: Color(hex: "FBBF24"),
                amberBg: Color(hex: "FBBF24").opacity(0.16),
                orange: Color(hex: "FB923C"),
                orangeBg: Color(hex: "FB923C").opacity(0.16),
                red: Color(hex: "EF4444"),
                redBg: Color(hex: "EF4444").opacity(0.16),
                sleepPurple: Color(hex: "818CF8"),
                sleepBg: Color(hex: "312E81").opacity(0.4)
            )
        case .light:
            return ThemeColors(
                background: Color(hex: "F1F5F9"),
                cardBackground: Color.white,
                cardBorder: Color.black.opacity(0.08),
                textPrimary: Color(hex: "0F172A"),
                textMuted: Color(hex: "64748B"),
                emerald: Color(hex: "059669"),
                emeraldBg: Color(hex: "059669").opacity(0.14),
                sky: Color(hex: "0284C7"),
                skyBg: Color(hex: "0284C7").opacity(0.14),
                amber: Color(hex: "D97706"),
                amberBg: Color(hex: "D97706").opacity(0.14),
                orange: Color(hex: "EA580C"),
                orangeBg: Color(hex: "EA580C").opacity(0.14),
                red: Color(hex: "E11D48"),
                redBg: Color(hex: "E11D48").opacity(0.14),
                sleepPurple: Color(hex: "4F46E5"),
                sleepBg: Color(hex: "4F46E5").opacity(0.12)
            )
        case .vibrant:
            return ThemeColors(
                background: Color(hex: "0D0722"),
                cardBackground: Color(hex: "1C1035"),
                cardBorder: Color(hex: "EC4899").opacity(0.35),
                textPrimary: Color.white,
                textMuted: Color(hex: "C4B5FD"),
                emerald: Color(hex: "00F59B"),
                emeraldBg: Color(hex: "00F59B").opacity(0.20),
                sky: Color(hex: "00E5FF"),
                skyBg: Color(hex: "00E5FF").opacity(0.20),
                amber: Color(hex: "FFD600"),
                amberBg: Color(hex: "FFD600").opacity(0.20),
                orange: Color(hex: "FF8400"),
                orangeBg: Color(hex: "FF8400").opacity(0.20),
                red: Color(hex: "FF007F"),
                redBg: Color(hex: "FF007F").opacity(0.20),
                sleepPurple: Color(hex: "A855F7"),
                sleepBg: Color(hex: "A855F7").opacity(0.25)
            )
        }
    }

    static var background: Color { colors(for: currentMode).background }
    static var cardBackground: Color { colors(for: currentMode).cardBackground }
    static var cardBorder: Color { colors(for: currentMode).cardBorder }
    
    static var textPrimary: Color { colors(for: currentMode).textPrimary }
    static var textMuted: Color { colors(for: currentMode).textMuted }
    
    static var emerald: Color { colors(for: currentMode).emerald }
    static var emeraldBg: Color { colors(for: currentMode).emeraldBg }
    
    static var sky: Color { colors(for: currentMode).sky }
    static var skyBg: Color { colors(for: currentMode).skyBg }
    
    static var amber: Color { colors(for: currentMode).amber }
    static var amberBg: Color { colors(for: currentMode).amberBg }
    
    static var orange: Color { colors(for: currentMode).orange }
    static var orangeBg: Color { colors(for: currentMode).orangeBg }
    
    static var red: Color { colors(for: currentMode).red }
    static var redBg: Color { colors(for: currentMode).redBg }
    
    static var sleepPurple: Color { colors(for: currentMode).sleepPurple }
    static var sleepBg: Color { colors(for: currentMode).sleepBg }
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
