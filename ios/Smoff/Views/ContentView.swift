import SwiftUI

struct ContentView: View {
    @StateObject private var store = SmoffStore()

    var body: some View {
        ZStack {
            SmoffTheme.background
                .ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(spacing: 12) {
                    // Top App Header
                    HStack {
                        HStack(spacing: 8) {
                            Circle()
                                .fill(store.isSleeping ? SmoffTheme.sleepPurple : SmoffTheme.emerald)
                                .frame(width: 8, height: 8)
                                .shadow(
                                    color: store.isSleeping ? SmoffTheme.sleepPurple.opacity(0.8) : SmoffTheme.emerald.opacity(0.8),
                                    radius: 4
                                )

                            Text("Smoff")
                                .font(.system(size: 18, weight: .heavy, design: .rounded))
                                .foregroundColor(SmoffTheme.textPrimary)
                        }

                        Spacer()

                        Button(action: {
                            store.toggleLanguage()
                        }) {
                            Text(store.isEnglish ? "VI" : "EN")
                                .font(.system(size: 12, weight: .bold, design: .rounded))
                                .foregroundColor(SmoffTheme.textPrimary)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color.white.opacity(0.08))
                                .clipShape(Capsule())
                                .overlay(
                                    Capsule().stroke(Color.white.opacity(0.14), lineWidth: 1)
                                )
                        }
                    }
                    .padding(.horizontal, 4)
                    .padding(.top, 4)

                    // Sleep Banner
                    if store.isSleeping {
                        HStack {
                            Text(store.isEnglish ? "🌙 Sleep hours (23:00–07:30)" : "🌙 Giờ ngủ (23:00–07:30)")
                                .font(.system(size: 12, weight: .medium, design: .rounded))
                                .foregroundColor(SmoffTheme.sleepPurple)

                            Spacer()

                            Text(store.isEnglish ? "Paused" : "Tạm dừng")
                                .font(.system(size: 12, weight: .bold, design: .rounded))
                                .foregroundColor(SmoffTheme.sleepPurple)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(SmoffTheme.sleepBg)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(SmoffTheme.sleepPurple.opacity(0.25), lineWidth: 1)
                        )
                        .transition(.move(edge: .top).combined(with: .opacity))
                    }

                    // Hero Card: "ĐÃ NHỊN" + Timer
                    HeroCardView(store: store)

                    // 3 Stats Grid: Nhịn dai nhất | Nhịn trung bình | Hút hôm nay
                    StatsGridView(store: store)

                    // 3 Action Buttons: 🚬 1, 2, 3
                    VStack(alignment: .leading, spacing: 8) {
                        SmokeButtonsView(store: store, isLarge: true)
                    }
                    .padding(10)
                    .background(SmoffTheme.cardBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .stroke(SmoffTheme.cardBorder, lineWidth: 1)
                    )

                    // History Card
                    HistoryListView(store: store)
                        .padding(.bottom, 24)
                }
                .padding(.horizontal, 16)
            }
        }
        .preferredColorScheme(.dark)
        .sheet(isPresented: $store.showHourlySheet) {
            HourlyModalSheet(store: store)
                .presentationDetents([.fraction(0.55), .medium])
                .presentationDragIndicator(.visible)
        }
        .onAppear {
            NotificationManager.shared.requestPermission()
        }
    }
}
