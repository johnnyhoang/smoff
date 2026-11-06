import SwiftUI

struct HeroCardView: View {
    @ObservedObject var store: SmoffStore

    var body: some View {
        VStack(spacing: 6) {
            Text("ĐÃ NHỊN")
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundColor(SmoffTheme.textMuted)
                .tracking(1.2)

            Text(TimeService.formatHMS(ms: store.currentAwakeMs))
                .font(.system(size: 46, weight: .heavy, design: .rounded))
                .monospacedDigit()
                .foregroundColor(SmoffTheme.textPrimary)
                .padding(.vertical, 2)

            HStack {
                if store.isNewRecord {
                    Text("🔥 Kỷ lục mới!")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(SmoffTheme.emerald)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(SmoffTheme.emeraldBg)
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(SmoffTheme.emerald.opacity(0.35), lineWidth: 1))
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .frame(minHeight: 22)
            .animation(.spring(response: 0.35, dampingFraction: 0.7), value: store.isNewRecord)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .padding(.horizontal, 16)
        .background(SmoffTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .stroke(SmoffTheme.cardBorder, lineWidth: 1)
        )
    }
}
