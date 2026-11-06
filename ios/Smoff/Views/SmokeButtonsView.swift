import SwiftUI

struct SmokeButtonsView: View {
    @ObservedObject var store: SmoffStore
    var isLarge: Bool = true

    var body: some View {
        HStack(spacing: 8) {
            // Nút 1: 1 điếu
            SmokeButton(
                accentColor: SmoffTheme.amber,
                bgColor: SmoffTheme.amberBg,
                borderColor: SmoffTheme.amber.opacity(0.35),
                isLarge: isLarge
            ) {
                store.recordSmoke(count: 1)
            } label: {
                Text("🚬")
                    .font(.system(size: isLarge ? 28 : 24))
                    .rotationEffect(.degrees(-6))
                    .shadow(color: .black.opacity(0.4), radius: 2, x: 0, y: 2)
            }

            // Nút 2: 2 điếu chồng nhau
            SmokeButton(
                accentColor: SmoffTheme.orange,
                bgColor: SmoffTheme.orangeBg,
                borderColor: SmoffTheme.orange.opacity(0.35),
                isLarge: isLarge
            ) {
                store.recordSmoke(count: 2)
            } label: {
                HStack(spacing: -14) {
                    Text("🚬")
                        .font(.system(size: isLarge ? 28 : 24))
                        .rotationEffect(.degrees(-10))
                        .offset(x: -2, y: 2)
                        .zIndex(1)

                    Text("🚬")
                        .font(.system(size: isLarge ? 28 : 24))
                        .rotationEffect(.degrees(-2))
                        .offset(x: 2, y: -3)
                        .shadow(color: .black.opacity(0.7), radius: 3, x: -2, y: 2)
                        .zIndex(2)
                }
            }

            // Nút 3: 3 điếu chồng nhau 3D
            SmokeButton(
                accentColor: SmoffTheme.red,
                bgColor: SmoffTheme.redBg,
                borderColor: SmoffTheme.red.opacity(0.35),
                isLarge: isLarge
            ) {
                store.recordSmoke(count: 3)
            } label: {
                HStack(spacing: -16) {
                    Text("🚬")
                        .font(.system(size: isLarge ? 28 : 24))
                        .rotationEffect(.degrees(-14))
                        .offset(x: -4, y: 3)
                        .zIndex(1)

                    Text("🚬")
                        .font(.system(size: isLarge ? 28 : 24))
                        .rotationEffect(.degrees(-5))
                        .offset(x: 0, y: -1)
                        .shadow(color: .black.opacity(0.7), radius: 3, x: -2, y: 2)
                        .zIndex(2)

                    Text("🚬")
                        .font(.system(size: isLarge ? 28 : 24))
                        .rotationEffect(.degrees(4))
                        .offset(x: 4, y: -5)
                        .shadow(color: .black.opacity(0.75), radius: 3, x: -2, y: 2)
                        .zIndex(3)
                }
            }
        }
    }
}

private struct SmokeButton<Label: View>: View {
    let accentColor: Color
    let bgColor: Color
    let borderColor: Color
    let isLarge: Bool
    let action: () -> Void
    let label: () -> Label

    @State private var isPressed: Bool = false

    var body: some View {
        Button(action: action) {
            label()
                .frame(maxWidth: .infinity)
                .frame(height: isLarge ? 58 : 50)
                .background(bgColor)
                .clipShape(RoundedRectangle(cornerRadius: isLarge ? 16 : 14, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: isLarge ? 16 : 14, style: .continuous)
                        .stroke(borderColor, lineWidth: 1)
                )
        }
        .buttonStyle(ScaleButtonStyle())
    }
}

private struct ScaleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.94 : 1.0)
            .animation(.spring(response: 0.2, dampingFraction: 0.6), value: configuration.isPressed)
    }
}
