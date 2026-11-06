import SwiftUI

struct HistoryListView: View {
    @ObservedObject var store: SmoffStore

    var body: some View {
        let metrics = store.computeMetrics()
        let threshold = metrics.monthlyAvgMs > 0 ? metrics.monthlyAvgMs : (2 * 3600 * 1000)
        let todayKey = TimeService.getLocalDateKey()
        let cutoff30d = Date().timeIntervalSince1970 * 1000 - TimeService.thirtyDaysMs
        let monthlyLogs = store.logs.filter { $0.timestamp >= cutoff30d }

        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Text("Lịch sử")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(SmoffTheme.textMuted)

                Spacer()

                if !store.logs.isEmpty {
                    Button(action: {
                        store.undo()
                    }) {
                        Text("↩ Hoàn tác")
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                            .foregroundColor(SmoffTheme.sky)
                    }
                }
            }
            .padding(.horizontal, 4)

            if monthlyLogs.isEmpty {
                Text("Chưa có lần hút nào")
                    .font(.system(size: 13, weight: .regular, design: .rounded))
                    .foregroundColor(SmoffTheme.textMuted.opacity(0.7))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
            } else {
                LazyVStack(spacing: 8) {
                    ForEach(monthlyLogs) { item in
                        HistoryRow(item: item, threshold: threshold, todayKey: todayKey)
                    }
                }
            }
        }
        .padding(14)
        .background(SmoffTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(SmoffTheme.cardBorder, lineWidth: 1)
        )
    }
}

private struct HistoryRow: View {
    let item: SmokeLog
    let threshold: Double
    let todayKey: String

    var isGood: Bool {
        item.eachIntervalMs >= threshold
    }

    var durationText: String {
        if item.count > 1 {
            return "\(TimeService.formatShortDuration(ms: item.eachIntervalMs))/điếu × \(item.count)"
        } else {
            return TimeService.formatShortDuration(ms: item.eachIntervalMs)
        }
    }

    var timeLabel: String {
        let date = Date(timeIntervalSince1970: item.timestamp / 1000)
        let timeStr = TimeService.formatTimeHHMM(date: date)
        if item.dateKey != todayKey {
            let cal = Calendar.current
            let d = cal.component(.day, from: date)
            let m = cal.component(.month, from: date)
            return "\(d)/\(m) \(timeStr)"
        }
        return timeStr
    }

    var body: some View {
        HStack {
            // Pill count
            Text("+\(item.count)")
                .font(.system(size: 11, weight: .heavy, design: .rounded))
                .foregroundColor(isGood ? SmoffTheme.emerald : SmoffTheme.red)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(isGood ? SmoffTheme.emeraldBg : SmoffTheme.redBg)
                .clipShape(Capsule())

            // Duration
            Text(durationText)
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundColor(isGood ? SmoffTheme.emerald : SmoffTheme.red)

            Spacer()

            // Timestamp
            Text(timeLabel)
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundColor(SmoffTheme.textMuted)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            LinearGradient(
                colors: isGood ? [
                    Color(hex: "064E3B").opacity(0.35),
                    Color(hex: "022C22").opacity(0.15)
                ] : [
                    Color(hex: "7F1D1D").opacity(0.35),
                    Color(hex: "450A0A").opacity(0.15)
                ],
                startPoint: .leading,
                endPoint: .trailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(
                    isGood ? SmoffTheme.emerald.opacity(0.25) : SmoffTheme.red.opacity(0.25),
                    lineWidth: 1
                )
        )
    }
}
