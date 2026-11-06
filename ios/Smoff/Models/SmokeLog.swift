import Foundation

struct SmokeLog: Identifiable, Codable, Equatable {
    let id: String
    let timestamp: Double // epoch milliseconds
    let count: Int
    let totalAwakeMs: Double
    let eachIntervalMs: Double
    let dateKey: String // yyyy-MM-dd
    let prevStreakStartMs: Double?
    let prevCheckInMs: Double?

    init(
        count: Int,
        totalAwakeMs: Double,
        dateKey: String,
        prevStreakStartMs: Double? = nil,
        prevCheckInMs: Double? = nil,
        timestamp: Double = Double(Date().timeIntervalSince1970 * 1000)
    ) {
        self.id = "\(Int64(timestamp))-\(UUID().uuidString.prefix(4).lowercased())"
        self.timestamp = timestamp
        self.count = count
        self.totalAwakeMs = totalAwakeMs
        self.eachIntervalMs = count > 0 ? (totalAwakeMs / Double(count)).rounded() : totalAwakeMs
        self.dateKey = dateKey
        self.prevStreakStartMs = prevStreakStartMs
        self.prevCheckInMs = prevCheckInMs
    }
}
