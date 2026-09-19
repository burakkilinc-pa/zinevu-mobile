import ARKit
import Combine
import RealityKit
import SwiftUI

/// A label drawn by SwiftUI at a projected world position.
struct ScreenLabel: Identifiable {
    let id: String
    let text: String
    let position: CGPoint
    let isBadge: Bool
}

/**
 The AR tape measure: find the floor, drop points on it, read back the
 rectangle they describe.

 The counterpart of `lib/ar/measure-engine.ts` in the browser, and deliberately
 built the same way — same rectangle rule, same minimum spacing, same three
 taps — because the two write the same measurement to the same draft and a
 dealer must not be able to tell which one a customer used.

 What is NOT the same is the tracking: this is ARKit with real plane detection
 and LiDAR where the phone has it, which is the entire reason the iPhone gets a
 native clip instead of a web page. Text is drawn by SwiftUI at projected
 screen positions rather than as 3D meshes: it stays crisp, it never ends up
 upside down, and it costs nothing to translate.
 */
@MainActor
final class MeasureEngine: NSObject, ObservableObject {
    /// Points closer together than this are a double-tap, not a measurement.
    private static let minimumSpacing: Float = 0.2
    /// Lift geometry off the floor plane so it does not z-fight with it.
    private static let floorLift: Float = 0.005
    /// A rectangle needs three points; two only ever describe a wall.
    static let minimumPoints = 3

    @Published private(set) var surfaceFound = false
    @Published private(set) var pointCount = 0
    @Published private(set) var widthMetres: Float = 0
    @Published private(set) var depthMetres: Float = 0
    @Published private(set) var areaM2: Float = 0
    @Published private(set) var swapped = false
    @Published private(set) var labels: [ScreenLabel] = []
    @Published private(set) var failure: MeasureFailure?

    enum MeasureFailure: Equatable {
        case cameraDenied
        case unsupported
        case session(String)
    }

    let arView = ARView(frame: .zero)
    /// Zinevu's lime until a dealer's own colour arrives. See `Palette`.
    var accent: UIColor = UIColor(red: 231 / 255, green: 255 / 255, blue: 164 / 255, alpha: 1)

    private var points: [SIMD3<Float>] = []
    private var floorY: Float = 0
    private var reticle: ModelEntity?
    private let rootAnchor = AnchorEntity(world: .zero)
    private var overlayEntities: [Entity] = []
    private var frameTick = 0
    /// The veranda, once it has been placed. Nil while measuring.
    private var placed: Entity?

    var canFinish: Bool { points.count >= Self.minimumPoints }

    // MARK: - Lifecycle

    func start() {
        guard ARWorldTrackingConfiguration.isSupported else {
            failure = .unsupported
            return
        }

        arView.automaticallyConfigureSession = false
        arView.environment.background = .cameraFeed()
        arView.renderOptions.insert(.disablePersonOcclusion)
        arView.session.delegate = self
        arView.scene.addAnchor(rootAnchor)
        buildReticle()

        let configuration = ARWorldTrackingConfiguration()
        configuration.planeDetection = [.horizontal]
        configuration.environmentTexturing = .none
        if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
            // LiDAR phones get a real floor instead of an estimated one — the
            // difference between a 3 cm error and a 15 cm one on a long run.
            configuration.sceneReconstruction = .mesh
        }
        arView.session.run(configuration, options: [.resetTracking, .removeExistingAnchors])
    }

    func stop() {
        arView.session.pause()
    }

    // MARK: - Actions

    func placePoint() {
        guard let reticle, surfaceFound else { return }

        var position = reticle.position(relativeTo: nil)
        if points.isEmpty { floorY = position.y }
        position.y = floorY

        if let last = points.last, simd_distance(last, position) < Self.minimumSpacing {
            return
        }

        points.append(position)
        redraw()
    }

    func undo() {
        guard !points.isEmpty else { return }
        points.removeLast()
        redraw()
    }

    func reset() {
        points.removeAll()
        swapped = false
        removePlacedModel()
        redraw()
    }

    /// The visitor put the wall on the wrong axis — swap what we call which.
    func swapAxes() {
        swapped.toggle()
        redraw()
    }

    func result(copy: Copy) -> (width: Float, depth: Float, points: [MeasurePoint])? {
        guard let rect = FloorRectangle.from(points: points, floorY: floorY),
              let origin = points.first
        else { return nil }

        return (
            width: swapped ? rect.depth : rect.width,
            depth: swapped ? rect.width : rect.depth,
            points: points.map {
                MeasurePoint(x: Double($0.x - origin.x), z: Double($0.z - origin.z))
            }
        )
    }

    // MARK: - Scene

    private func buildReticle() {
        // `start()` runs again on "measure again"; without this the old
        // crosshair stays in the scene next to the new one.
        reticle?.removeFromParent()
        let ring = ModelEntity(
            mesh: .generatePlane(width: 0.16, depth: 0.16, cornerRadius: 0.08),
            materials: [unlit(accent.withAlphaComponent(0.35))]
        )
        let dot = ModelEntity(
            mesh: .generatePlane(width: 0.03, depth: 0.03, cornerRadius: 0.015),
            materials: [unlit(accent)]
        )
        dot.position.y = 0.001
        ring.addChild(dot)
        ring.isEnabled = false
        rootAnchor.addChild(ring)
        reticle = ring
    }

    private func unlit(_ color: UIColor) -> UnlitMaterial {
        var material = UnlitMaterial(color: color)
        material.blending = .transparent(opacity: .init(floatLiteral: Float(color.cgColor.alpha)))
        return material
    }

    /// Rebuild the placed markers and the derived rectangle.
    private func redraw() {
        overlayEntities.forEach { $0.removeFromParent() }
        overlayEntities.removeAll()

        for point in points {
            let disc = ModelEntity(
                mesh: .generatePlane(width: 0.07, depth: 0.07, cornerRadius: 0.035),
                materials: [unlit(accent)]
            )
            disc.position = SIMD3(point.x, floorY + Self.floorLift, point.z)
            rootAnchor.addChild(disc)
            overlayEntities.append(disc)
        }

        if let rect = FloorRectangle.from(points: points, floorY: floorY), rect.width > 0.01 {
            let plane = ModelEntity(
                mesh: .generatePlane(width: rect.width, depth: max(rect.depth, 0.01)),
                materials: [unlit(accent.withAlphaComponent(0.22))]
            )
            plane.transform = Transform(matrix: Self.basis(for: rect, floorY: floorY))
            rootAnchor.addChild(plane)
            overlayEntities.append(plane)
        }

        pointCount = points.count
        publishDimensions()
    }

    /**
     Place the translucent footprint on the floor, turned to line up with the
     wall the first two points drew: local X follows that edge, local Z follows
     the perpendicular. Built by hand rather than with `look(at:)` — the plane
     has to sit flat on the floor, and a look-at would tilt it towards whatever
     it was aimed at.
     */
    private static func basis(for rect: FloorRectangle, floorY: Float) -> float4x4 {
        let a = rect.corners[0], b = rect.corners[1], c = rect.corners[2]
        var u = b - a; u.y = 0
        u = simd_length_squared(u) > 1e-6 ? simd_normalize(u) : SIMD3(1, 0, 0)
        let v = SIMD3<Float>(u.z, 0, -u.x)

        var centre = (a + c) / 2
        centre.y = floorY + floorLift

        return float4x4(
            SIMD4(u.x, u.y, u.z, 0),
            SIMD4(0, 1, 0, 0),
            SIMD4(-v.x, -v.y, -v.z, 0),
            SIMD4(centre.x, centre.y, centre.z, 1)
        )
    }

    // MARK: - Standing the veranda in it

    /**
     Put the measured veranda where it was measured.

     This is the moment the whole feature is for, and it is one transform.

     The model comes out of the configurator centred on its own footprint, with
     the width along local X and the house side at local −Z: the scene builds it
     against a wall at z = −2.9 and grows it towards the garden as the depth
     rises. So the placement has to answer two questions — which way is the
     wall, and which way is "right" — and the measurement already knows both.

     The wall is the edge through the first two points. The model's back goes on
     it, centred, and it grows away from it by however deep the design actually
     is — read off the loaded model rather than off the measurement, because the
     dealer's own maximum may have capped it and a veranda drawn to a size
     nobody sells would be a lie told at full scale in somebody's garden.

     "Right" is the visitor's. In the configurator they look at the veranda from
     the garden with +X to their right; standing here they are looking at the
     same wall from the same side, so the model's +X follows
     `cross(-away, up)` — the right hand of somebody facing the house. Get that
     backwards and a left-hand side wall appears on the right, which is exactly
     the kind of thing a customer signs for and only notices on installation
     day.
     */
    @discardableResult
    func place(modelAt url: URL) -> Bool {
        guard let rect = FloorRectangle.from(points: points, floorY: floorY) else {
            return false
        }

        guard let model = try? Entity.load(contentsOf: url) else { return false }

        removePlacedModel()

        // Its own depth, not the measured one. `visualBounds` is in the
        // entity's own space before it is anchored, which is what we want: the
        // distance from the wall to the front posts.
        let bounds = model.visualBounds(relativeTo: model)
        let modelDepth = max(bounds.extents.z, 0.01)

        let up = SIMD3<Float>(0, 1, 0)
        let forward = rect.away                      // wall → garden
        let right = simd_cross(-forward, up)         // the visitor's right hand

        var centre = rect.wallMid + forward * (modelDepth / 2)
        centre.y = floorY

        let basis = float4x4(
            SIMD4(right.x, right.y, right.z, 0),
            SIMD4(up.x, up.y, up.z, 0),
            SIMD4(forward.x, forward.y, forward.z, 0),
            SIMD4(centre.x, centre.y, centre.z, 1)
        )

        model.transform = Transform(matrix: basis)
        rootAnchor.addChild(model)
        placed = model

        // The footprint and the pills were scaffolding for a measurement that
        // is now finished, and they read as clutter under a veranda.
        overlayEntities.forEach { $0.removeFromParent() }
        overlayEntities.removeAll()
        labels = []
        reticle?.isEnabled = false

        return true
    }

    private func removePlacedModel() {
        placed?.removeFromParent()
        placed = nil
        reticle?.isEnabled = true
    }

    private func publishDimensions() {
        guard let rect = FloorRectangle.from(points: points, floorY: floorY) else {
            widthMetres = 0; depthMetres = 0; areaM2 = 0
            return
        }
        widthMetres = swapped ? rect.depth : rect.width
        depthMetres = swapped ? rect.width : rect.depth
        areaM2 = rect.width * rect.depth
    }

    // MARK: - Labels

    /**
     Project the dimension pills and point numbers into screen space.

     Throttled to every third frame: the numbers move with the phone, but they
     move slowly, and re-laying out SwiftUI sixty times a second to chase a
     millimetre is how an AR view starts dropping frames.
     */
    private func updateLabels(copy: Copy) {
        var next: [ScreenLabel] = []

        for (index, point) in points.enumerated() {
            let world = SIMD3(point.x, floorY + 0.12, point.z)
            if let screen = arView.project(world) {
                next.append(
                    ScreenLabel(
                        id: "p\(index)",
                        text: "\(index + 1)",
                        position: screen,
                        isBadge: true
                    )
                )
            }
        }

        if let rect = FloorRectangle.from(points: points, floorY: floorY), rect.width > 0.05 {
            let widthWord = swapped ? copy.axisDepth : copy.axisWidth
            let depthWord = swapped ? copy.axisWidth : copy.axisDepth

            let widthMid = (rect.corners[0] + rect.corners[1]) / 2
            if let screen = arView.project(SIMD3(widthMid.x, floorY + 0.14, widthMid.z)) {
                next.append(
                    ScreenLabel(
                        id: "w",
                        text: "\(widthWord): \(format(rect.width))",
                        position: screen,
                        isBadge: false
                    )
                )
            }

            if rect.depth > 0.05 {
                let depthMid = (rect.corners[1] + rect.corners[2]) / 2
                if let screen = arView.project(SIMD3(depthMid.x, floorY + 0.14, depthMid.z)) {
                    next.append(
                        ScreenLabel(
                            id: "d",
                            text: "\(depthWord): \(format(rect.depth))",
                            position: screen,
                            isBadge: false
                        )
                    )
                }
            }
        }

        labels = next
    }

    private func format(_ metres: Float) -> String {
        String(format: "%.2f m", metres)
    }

    var copyForLabels: Copy = .dutch
}

// MARK: - ARSessionDelegate

extension MeasureEngine: ARSessionDelegate {
    nonisolated func session(_ session: ARSession, didUpdate frame: ARFrame) {
        Task { @MainActor in self.onFrame() }
    }

    nonisolated func session(_ session: ARSession, didFailWithError error: Error) {
        Task { @MainActor in
            let arError = error as? ARError
            self.failure = arError?.code == .cameraUnauthorized
                ? .cameraDenied
                : .session(error.localizedDescription)
        }
    }

    @MainActor
    private func onFrame() {
        // A veranda is standing in the scene, so there is nothing left to aim
        // at. Without this the loop keeps re-enabling the crosshair over the
        // roof and re-publishing the measurement pills twenty times a second —
        // which is not just clutter: every one of those is a SwiftUI render of
        // the screen the AR view is mounted in.
        guard placed == nil else { return }

        // Raycast down the middle of the screen: the crosshair IS the aim, so
        // there is nothing for the visitor to line up but the phone itself.
        let centre = CGPoint(x: arView.bounds.midX, y: arView.bounds.midY)
        guard centre.x > 0 else { return }

        let hit = arView.raycast(
            from: centre,
            allowing: .estimatedPlane,
            alignment: .horizontal
        ).first

        if let hit {
            reticle?.isEnabled = true
            reticle?.transform.translation = SIMD3(
                hit.worldTransform.columns.3.x,
                hit.worldTransform.columns.3.y + Self.floorLift,
                hit.worldTransform.columns.3.z
            )
        } else {
            reticle?.isEnabled = false
        }

        if (hit != nil) != surfaceFound { surfaceFound = hit != nil }

        frameTick += 1
        if frameTick % 3 == 0 { updateLabels(copy: copyForLabels) }
    }
}
