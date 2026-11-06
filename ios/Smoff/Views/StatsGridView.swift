import SwiftUI

struct StatsGridView: View {
    @ObservedObject var store: SmoffStore

    var body: some View {
        let metrics = store.computeMetrics()

        HStack(spacing: 8) {
            // Cột 1: Nhịn dai nhất
            StatCard(
                title: "Nhịn dai nhất",
                value: TimeService.formatShortDuration(ms: metrics.pastRecordMs),
                valueColor: SmoffTheme.emerald,
                subtext: nil
            )

            // Cột 2: Nhịn trung bình
            StatCard(
                title: "Nhịn trung bình",
                value: TimeService.formatShortDuration(ms: metrics.monthlyAvgMs),
                valueColor: SmoffTheme.sky,
                subtext: "TB: \(metrics.dailyAvgCigs) điếu/ngày"
            )

            // Cột 3: Hút hôm nay
            StatCard(
                title: "Hút hôm nay",
                value: "\(metrics.todayCigs)",
                valueColor: SmoffTheme.amber,
                subtext: "\(metrics.sumCigs30d) điếu từ \(metrics.startDateStr)"
            )
        }
    }
}

private struct StatCard: View {
    let title: String
    let value: String
    let valueColor: Color
    let subtext: String?

    var body: some View {
        VStack(spacing: 4) {
            Text(title)
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundColor(SmoffTheme.textMuted)
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            Text(value)
                .font(.system(size: 17, weight: .bold, design: .rounded))
                .foregroundColor(valueColor)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            if let sub = subtext {
                Text(sub)
                    .font(.system(size: 10, weight: .regular, design: .rounded))
                    .foregroundColor(SmoffTheme.textMuted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            } else {
                Spacer()
                    .frame(height: 12)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .padding(.horizontal, 6)
        .background(SmoffTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(SmoffTheme.cardBorder, lineWidth: 1)
        )
    }
}
