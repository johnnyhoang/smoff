import SwiftUI

struct HourlyModalSheet: View {
    @ObservedObject var store: SmoffStore

    var body: some View {
        let metrics = store.computeMetrics()
        let en = store.isEnglish

        ScrollView(showsIndicators: false) {
            VStack(spacing: 16) {
                // Header
                Text(en ? "Past 1 hour" : "1 tiếng vừa qua")
                    .font(.system(size: 20, weight: .heavy, design: .rounded))
                    .foregroundColor(SmoffTheme.textPrimary)
                    .padding(.top, 4)

                // Stats recap
                VStack(spacing: 10) {
                    StatRow(
                        label: en ? "Clean streak" : "Đã nhịn",
                        value: TimeService.formatShortDuration(ms: store.currentAwakeMs, isEnglish: en),
                        color: SmoffTheme.textPrimary
                    )

                    StatRow(
                        label: en ? "Best streak" : "Nhịn dai nhất",
                        value: TimeService.formatShortDuration(ms: metrics.pastRecordMs, isEnglish: en),
                        color: SmoffTheme.emerald
                    )

                    StatRow(
                        label: en ? "Average streak" : "Nhịn trung bình",
                        value: en
                            ? "\(TimeService.formatShortDuration(ms: metrics.monthlyAvgMs, isEnglish: true)) (Avg: \(metrics.dailyAvgCigs)/day)"
                            : "\(TimeService.formatShortDuration(ms: metrics.monthlyAvgMs, isEnglish: false)) (TB: \(metrics.dailyAvgCigs)/ngày)",
                        color: SmoffTheme.sky
                    )

                    StatRow(
                        label: en ? "Smoked today" : "Hút hôm nay",
                        value: en
                            ? "\(metrics.todayCigs) cigs (\(metrics.sumCigs30d) cigs since \(metrics.startDateStr))"
                            : "\(metrics.todayCigs) điếu (\(metrics.sumCigs30d) điếu từ \(metrics.startDateStr))",
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
                    Text(en ? "Haven't smoked" : "Chưa hút")
                        .font(.system(size: 16, weight: .heavy, design: .rounded))
                        .foregroundColor(Color(hex: "06281E"))
                        .frame(maxWidth: .infinity)
                        .frame(height: 50)
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
                .padding(.top, 2)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
        }
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
