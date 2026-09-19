import Foundation
import simd

/**
 The measurement contract, in Swift.

 A line-for-line port of `src/features/configurator-3d/lib/ar/measurement.ts`:
 the same JSON, written to the same draft, read by the same desktop. The web's
 WebXR tape measure and this one are interchangeable by design — the only field
 that differs between them is `source`.

 Keep the two in step. The desktop validates defensively and treats anything it
 does not recognise as "not measured yet", so a field renamed on one side does
 not error: it silently stops arriving.
 */
struct MeasurePoint: Codable, Equatable {
    let x: Double
    let z: Double
}

struct Measurement: Codable {
    let widthCm: Int
    let depthCm: Int
    let areaM2: Double?
    let points: [MeasurePoint]
    /// Always "arkit" from this app; the browser writes "webxr".
    let source: String
    let measuredAt: String
    let rawWidthCm: Int?
    let rawDepthCm: Int?
    let clamped: Bool?

    enum CodingKeys: String, CodingKey {
        case widthCm = "width_cm"
        case depthCm = "depth_cm"
        case areaM2 = "area_m2"
        case points
        case source
        case measuredAt = "measured_at"
        case rawWidthCm = "raw_width_cm"
        case rawDepthCm = "raw_depth_cm"
        case clamped
    }
}

/// The sizes this dealer actually sells; a measurement is clamped into them.
struct DimensionBounds {
    let min: Int
    let max: Int

    static let width = DimensionBounds(min: 100, max: 1500)
    static let depth = DimensionBounds(min: 100, max: 600)
}

enum MeasurementBuilder {
    /// Whole centimetres, never zero — a 0 would blank the veranda on screen.
    private static func cm(_ metres: Float) -> Int {
        max(1, Int((metres * 100).rounded()))
    }

    /**
     Build the stored measurement from raw metres.

     Clamping is not a correction: a 9 m terrace measured against a 7 m maximum
     is a real answer, so the raw numbers survive next to the capped ones and
     the visitor is told the veranda was capped rather than quietly shown a
     different one.
     */
    static func build(
        widthMetres: Float,
        depthMetres: Float,
        points: [MeasurePoint],
        widthBounds: DimensionBounds = .width,
        depthBounds: DimensionBounds = .depth
    ) -> Measurement {
        let rawWidth = cm(widthMetres)
        let rawDepth = cm(depthMetres)
        let width = min(max(rawWidth, widthBounds.min), widthBounds.max)
        let depth = min(max(rawDepth, depthBounds.min), depthBounds.max)
        let clamped = width != rawWidth || depth != rawDepth

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        return Measurement(
            widthCm: width,
            depthCm: depth,
            areaM2: points.count >= 3
                ? (Double(widthMetres * depthMetres) * 10).rounded() / 10
                : nil,
            points: points.map {
                MeasurePoint(
                    x: (($0.x * 1000).rounded()) / 1000,
                    z: (($0.z * 1000).rounded()) / 1000
                )
            },
            source: "arkit",
            measuredAt: formatter.string(from: Date()),
            rawWidthCm: clamped ? rawWidth : nil,
            rawDepthCm: clamped ? rawDepth : nil,
            clamped: clamped ? true : nil
        )
    }
}

/**
 The rectangle a set of floor points describes.

 The first edge (point 1 → point 2) is taken as the house wall and gives the
 width axis; the depth is the span of everything else perpendicular to it. An
 oriented box rather than a polygon because that is what the configurator
 sells — an L-shaped terrace is quoted as the rectangle that fits it, with the
 raw points kept so the dealer can still see the real shape.

 Identical to `ARMeasureEngine.rectangle()` in the browser. Both surfaces have
 to answer the same width for the same three taps.
 */
struct FloorRectangle {
    let width: Float
    let depth: Float
    let corners: [SIMD3<Float>]
    /// Unit vector along the house wall — the direction the width runs in.
    let alongWall: SIMD3<Float>
    /// Unit vector from the wall out into the garden. A veranda grows this way.
    let away: SIMD3<Float>
    /// Middle of the wall edge, on the floor. Where a veranda's back goes.
    let wallMid: SIMD3<Float>

    static func from(points: [SIMD3<Float>], floorY: Float) -> FloorRectangle? {
        guard points.count >= 2 else { return nil }
        let origin = points[0]

        var u = points[1] - origin
        u.y = 0
        guard simd_length_squared(u) > 1e-6 else { return nil }
        u = simd_normalize(u)
        let v = SIMD3<Float>(u.z, 0, -u.x)

        var minA: Float = 0, maxA: Float = 0, minB: Float = 0, maxB: Float = 0
        for point in points {
            let d = point - origin
            let a = simd_dot(d, u)
            let b = simd_dot(d, v)
            minA = min(minA, a); maxA = max(maxA, a)
            minB = min(minB, b); maxB = max(maxB, b)
        }

        let corners = [(minA, minB), (maxA, minB), (maxA, maxB), (minA, maxB)]
            .map { a, b -> SIMD3<Float> in
                var corner = origin + u * a + v * b
                corner.y = floorY
                return corner
            }

        // Which way is "away from the house".
        //
        // The first two points are placed against the wall, so both sit at
        // b = 0 — and b = 0 is therefore one of the two edges, whichever of
        // minB/maxB is the zero one. Everything the visitor measured lies on
        // the other side of it, and that is the direction a veranda extends.
        let awayIsPositive = abs(maxB) >= abs(minB)
        let away = awayIsPositive ? v : -v
        let wallB = awayIsPositive ? minB : maxB
        var wallMid = origin + u * ((minA + maxA) / 2) + v * wallB
        wallMid.y = floorY

        return FloorRectangle(
            width: maxA - minA,
            depth: maxB - minB,
            corners: corners,
            alongWall: u,
            away: away,
            wallMid: wallMid
        )
    }
}
