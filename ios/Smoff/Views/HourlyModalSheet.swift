import SwiftUI

struct HourlyModalSheet: View {
    @ObservedObject var store: SmoffStore

    var body: some View {
        let metrics = store.computeMetrics()

        VStack(spacing: 18) {
            // Header
            Text("1 tiếng vừa qua")
                .font(.system(size: 20, weight: .heavy, design: .rounded))
                .foregroundColor(SmoffTheme.textPrimary)
                .padding(.top, 8)

            // Stats recap
            VStack(spacing: 10) {
                StatRow(
                    label: "Đã nhịn",
                    value: TimeService.formatShortDuration(ms: store.currentAwakeMs),
                    color: SmoffTheme.textPrimary
                )

                StatRow(
                    label: "Nhịn dai nhất",
                    value: TimeService.formatShortDuration(ms: metrics.pastRecordMs),
                    color: SmoffTheme.emerald
                )

                StatRow(
                    label: "Nhịn trung bình",
                    value: "\(TimeService.formatShortDuration(ms: metrics.monthlyAvgMs)) (TB: \(metrics.dailyAvgCigs)/ngày)",
                    color: SmoffTheme.sky
                )

                StatRow(
                    label: "Hút hôm nay",
                    value: "\(metrics.todayCigs) điếu (\(metrics.sumCigs30d) điếu từ \(metrics.startDateStr))",
                    color: SmoffTheme.amber
                )
            }
            .padding(14)
            .background(Color.white.opacity(0.04))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(SmoffTheme.cardBorder, lineWidth: 1)
            )

            // 3 cigarette buttons
            SmokeButtonsView(store: store, isLarge: false)

            // Nút "Chưa hút" to màu xanh lá cây
            Button(action: {
                store.recordSmoke(count: 0)
            }) {
                Text("Chưa hút")
                    .font(.system(size: 16, weight: .heavy, design: .rounded))
                    .foregroundColor(Color(hex: "06281E"))
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(
                        LinearGradient(
                            colors: [SmoffTheme.emerald, Color(hex: "059669")],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .shadow(color: SmoffTheme.emerald.opacity(0.35), radius: 8, x: 0, y: 4)
            }
            .padding(.top, 4)
        }
        .padding(20)
        .background(SmoffTheme.cardBackground)
        .preferredColorScheme(.dark)
    }
}

private struct StatRow: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundColor(SmoffTheme.textMuted)

            Spacer()

            Text(value)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(color)
        }
    }
}
