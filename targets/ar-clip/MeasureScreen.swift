import ARKit
import RealityKit
import SwiftUI

/// Hands the engine's own ARView to SwiftUI. It owns the view; this only shows it.
struct ARViewContainer: UIViewRepresentable {
    let engine: MeasureEngine

    func makeUIView(context: Context) -> ARView { engine.arView }
    func updateUIView(_ uiView: ARView, context: Context) {}
}

/**
 The two colours every screen here is painted with.

 `accent` is the dealer's own, when there is a dealer — the clip opens on their
 customer's phone and should wear their colour, not ours. Without one it is
 Zinevu's lime tile, the same `#E7FFA4` the mark is drawn on.

 `onAccent` is the half that cannot be a constant. Zinevu's accent is a pale
 lime and a dealer's may be anything from black to bright yellow, so the label
 on top of it is chosen by luminance rather than assumed to be white — white on
 lime is invisible, and that is not a detail a customer standing in their
 garden should have to work around.
 */
struct Palette {
    let accent: Color
    let onAccent: Color
    let uiAccent: UIColor

    /// Zinevu's own mark colour — see public/icons/logo-sm.svg.
    static let zinevuLime = "#E7FFA4"

    init(hex: String?) {
        let components = Palette.components(hex) ?? Palette.components(Palette.zinevuLime)!
        let (r, g, b) = components

        accent = Color(red: r, green: g, blue: b)
        uiAccent = UIColor(red: r, green: g, blue: b, alpha: 1)

        // WCAG relative luminance. The threshold sits high on purpose: these
        // are large, solid fills, and mid-tones read better with black on them
        // than the 0.5 midpoint would suggest.
        func linear(_ channel: Double) -> Double {
            channel <= 0.03928 ? channel / 12.92 : pow((channel + 0.055) / 1.055, 2.4)
        }
        let luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
        onAccent = luminance > 0.45 ? .black : .white
    }

    private static func components(_ hex: String?) -> (Double, Double, Double)? {
        guard var value = hex?.trimmingCharacters(in: .whitespaces), !value.isEmpty else {
            return nil
        }
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6, let rgb = UInt32(value, radix: 16) else { return nil }
        return (
            Double((rgb >> 16) & 0xFF) / 255,
            Double((rgb >> 8) & 0xFF) / 255,
            Double(rgb & 0xFF) / 255
        )
    }
}

/**
 The whole customer-facing flow, from "point your camera at the ground" to
 "your sizes are on your computer".

 One view for both targets. The App Clip mounts it with the invocation the QR
 code carried; the App Store app mounts it with an empty one and simply keeps
 the answer on the phone. Everything that differs between the two is in
 `Invocation`, which is the point: there is one measuring experience, and the
 clip is not a lesser version of it.
 */
struct MeasureFlowView: View {
    let invocation: Invocation

    @StateObject private var engine = MeasureEngine()
    @State private var stage: Stage = .intro
    @State private var branding = Branding()
    @State private var saved: Measurement?
    @State private var saveFailed = false
    @State private var model: ModelState = .idle
    /// Leaving the clip for the browser — the only exit this screen has.
    @Environment(\.openURL) private var openURL

    private enum Stage { case intro, measuring, saving, done, previewing }

    /**
     The veranda itself, on its way from the server.

     Building it means compiling this design's whole 3D scene in a headless
     browser with no GPU, so it is minutes away, not seconds — which is why the
     asking starts the instant the measurement is saved rather than when the
     visitor taps. By the time they have read their own numbers it is often
     already here.
     */
    private enum ModelState: Equatable {
        case idle
        case building
        case ready(URL)
        /// No model will ever come — no draft, or nothing in it to draw.
        case unavailable
    }

    private var copy: Copy { Copy.of(invocation.language) }
    private var palette: Palette { Palette(hex: branding.accentHex) }
    private var accent: Color { palette.accent }
    /// What to write ON the accent — never assumed to be white. See Palette.
    private var onAccent: Color { palette.onAccent }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            // The camera is mounted ONCE, here, and deliberately not inside the
            // stage below.
            //
            // `makeUIView` hands SwiftUI the engine's own ARView — there is
            // only one, because there is only one AR session and it must not be
            // restarted. Putting the container inside the switch made each
            // stage its own representable, so moving from measuring to
            // previewing tore the first one down and built a second around the
            // same UIView: the ARView was pulled out of one view hierarchy and
            // pushed into another, and RealityKit stopped drawing. The picture
            // froze on the last frame with the veranda in it, which looks
            // exactly like a crash and is a view-identity bug.
            //
            // One position in the tree, one identity, no remount — and that
            // has to hold across SAVING and DONE too, not just between the two
            // stages that show it. Those two are the whole reason the session
            // is left running: pausing ARKit re-seats the world origin, and the
            // veranda would then stand near where the terrace was measured
            // rather than on it. So the camera stays mounted and they simply
            // cover it.
            if stage != .intro {
                ARViewContainer(engine: engine).ignoresSafeArea()
            }
            if stage == .saving || stage == .done {
                Color.black.ignoresSafeArea()
            }

            switch stage {
            case .intro: intro
            case .measuring: camera
            case .saving: saving
            case .done: done
            case .previewing: preview
            }
        }
        .preferredColorScheme(.dark)
        .task {
            engine.copyForLabels = copy
            guard let slug = invocation.slug else { return }
            branding = await DraftClient().branding(slug: slug, language: invocation.language)
            engine.accent = palette.uiAccent
        }
        // The whole flow leaving — including InvocationRoot remounting it for a
        // new URL — is the one moment the camera may stop.
        .onDisappear { engine.stop() }
        .onChange(of: engine.failure) { _ in
            // A camera the visitor said no to is not an error state to sit in
            // the AR view with — back to the intro, which explains it.
            if engine.failure != nil { stage = .intro }
        }
    }

    // MARK: - Intro

    private var intro: some View {
        VStack(spacing: 22) {
            Spacer()

            if let name = branding.dealerName {
                Text(name)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.5))
            }

            Image(systemName: "arkit")
                .font(.system(size: 44))
                .foregroundStyle(accent)

            VStack(spacing: 8) {
                Text(copy.introTitle)
                    .font(.title.bold())
                Text(copy.introSubtitle)
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.7))
            }
            .multilineTextAlignment(.center)

            VStack(alignment: .leading, spacing: 14) {
                step(1, copy.step1)
                step(2, copy.step2)
                step(3, copy.step3)
            }
            .padding(.vertical, 4)

            if invocation.draftUuid == nil, let last = MeasurementStore.last {
                HStack(spacing: 6) {
                    Image(systemName: "clock.arrow.circlepath")
                    Text("\(metres(last.widthCm)) × \(metres(last.depthCm)) m")
                }
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.white.opacity(0.55))
            }

            if let failure = engine.failure {
                Text(failure == .cameraDenied ? copy.errorPermission : copy.errorBody)
                    .font(.footnote)
                    .foregroundStyle(.orange)
                    .multilineTextAlignment(.center)
            }

            Spacer()

            Button {
                engine.start()
                stage = .measuring
            } label: {
                Text(engine.failure == nil ? copy.start : copy.retry)
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 17)
                    .background(accent, in: RoundedRectangle(cornerRadius: 18))
                    .foregroundStyle(onAccent)
            }

            Text(copy.disclaimer)
                .font(.caption2)
                .foregroundStyle(.white.opacity(0.35))
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 26)
        .padding(.bottom, 18)
        .foregroundStyle(.white)
    }

    private func step(_ number: Int, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(number)")
                .font(.caption.bold())
                .foregroundStyle(onAccent)
                .frame(width: 24, height: 24)
                .background(accent, in: Circle())
            Text(text)
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.8))
        }
    }

    // MARK: - Camera

    private var camera: some View {
        ZStack {
            // No ARViewContainer here — see `body`. This is chrome only.

            // The pills live ON the floor, so they are drawn where the engine
            // says the floor is on screen rather than in a fixed corner.
            ForEach(engine.labels) { label in
                pill(label)
                    .position(label.position)
            }

            VStack {
                HStack {
                    Spacer()
                    Text(
                        engine.canFinish
                            ? copy.badgeReady
                            : String(format: copy.points, engine.pointCount, MeasureEngine.minimumPoints)
                    )
                    .font(.footnote.weight(.semibold))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(
                        engine.canFinish ? AnyShapeStyle(accent) : AnyShapeStyle(.black.opacity(0.55)),
                        in: Capsule()
                    )
                    .foregroundStyle(engine.canFinish ? onAccent : .white)
                }

                Spacer()
                controls
            }
            .padding(.horizontal, 18)
            .padding(.bottom, 10)
            .foregroundStyle(.white)
        }
        // No `onDisappear { engine.stop() }` here. This chrome disappears the
        // moment Done is tapped, and pausing the session there froze the
        // camera on its last frame — the veranda was then placed into a
        // picture that no longer moved. The session is stopped where the flow
        // really ends: `finish()` without a model, and `body` going away.
    }

    private func pill(_ label: ScreenLabel) -> some View {
        Text(label.text)
            .font(label.isBadge ? .caption2.bold() : .footnote.weight(.semibold))
            .foregroundStyle(onAccent)
            .padding(.horizontal, label.isBadge ? 7 : 12)
            .padding(.vertical, label.isBadge ? 4 : 7)
            .background(accent, in: Capsule())
            .shadow(radius: 4, y: 1)
    }

    private var controls: some View {
        VStack(spacing: 14) {
            Text(hint)
                .font(.footnote)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(.black.opacity(0.55), in: Capsule())

            if engine.pointCount >= 2 {
                HStack(spacing: 0) {
                    readout(copy.axisWidth, engine.widthMetres, unit: "m")
                    readout(copy.axisDepth, engine.depthMetres, unit: "m")
                    readout(copy.axisArea, engine.areaM2, unit: "m²", dimmed: true)
                }
                .background(.black.opacity(0.6), in: RoundedRectangle(cornerRadius: 18))
            }

            HStack {
                secondary(copy.undo, enabled: engine.pointCount > 0) { engine.undo() }
                Spacer()
                Button {
                    engine.placePoint()
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 30, weight: .bold))
                        .frame(width: 78, height: 78)
                        .background(accent, in: Circle())
                        .foregroundStyle(onAccent)
                        .opacity(engine.surfaceFound ? 1 : 0.4)
                }
                .disabled(!engine.surfaceFound)
                Spacer()
                secondary(copy.swap, enabled: engine.pointCount >= 3) { engine.swapAxes() }
            }

            Button {
                Task { await finish() }
            } label: {
                Text(copy.done)
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(
                        engine.canFinish ? AnyShapeStyle(accent) : AnyShapeStyle(Color.gray.opacity(0.4)),
                        in: RoundedRectangle(cornerRadius: 18)
                    )
                    .foregroundStyle(engine.canFinish ? onAccent : .white)
            }
            .disabled(!engine.canFinish)
        }
    }

    private func secondary(_ title: String, enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(.black.opacity(0.55), in: RoundedRectangle(cornerRadius: 16))
                .foregroundStyle(.white)
        }
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.35)
    }

    private func readout(_ title: String, _ value: Float, unit: String, dimmed: Bool = false) -> some View {
        VStack(spacing: 2) {
            Text(title.uppercased())
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(.white.opacity(0.5))
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(String(format: unit == "m" ? "%.2f" : "%.1f", value))
                    .font(.title3.bold().monospacedDigit())
                Text(unit)
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.6))
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .opacity(dimmed ? 0.65 : 1)
    }

    private var hint: String {
        switch engine.pointCount {
        case 0: return engine.surfaceFound ? copy.hintFirst : copy.hintScanning
        case 1: return copy.hintSecond
        default: return engine.canFinish ? copy.hintReady : copy.hintThird
        }
    }

    // MARK: - Saving

    private var saving: some View {
        VStack(spacing: 16) {
            ProgressView().tint(.white)
            Text(copy.saving)
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.7))
        }
    }

    private func finish() async {
        guard let result = engine.result(copy: copy) else { return }
        stage = .saving

        let measurement = MeasurementBuilder.build(
            widthMetres: result.width,
            depthMetres: result.depth,
            points: result.points,
            widthBounds: branding.widthBounds,
            depthBounds: branding.depthBounds
        )

        if let draft = invocation.draftUuid {
            do {
                try await DraftClient().save(
                    measurement: measurement,
                    draftUuid: draft,
                    language: invocation.language
                )
                saveFailed = false
            } catch {
                saveFailed = true
            }
        } else {
            // No draft to write into (the App Store app, or a link without one):
            // the numbers on screen are still the point of the exercise.
            saveFailed = false
            MeasurementStore.remember(measurement)
        }

        saved = measurement
        stage = .done

        // The session stays RUNNING. Pausing ARKit here and resuming it later
        // would re-seat the world origin, and the veranda would then stand
        // somewhere near where the terrace was measured rather than on it —
        // which is the one thing this whole feature exists to get right.
        if let draft = invocation.draftUuid, !saveFailed {
            await fetchModel(draftUuid: draft)
        } else {
            engine.stop()
            model = .unavailable
        }
    }

    /**
     Ask for the model until it exists.

     The server answers 202 while it bakes, so this is a poll, and it is a long
     one by design — the alternative is a request held open for minutes across a
     phone that may sleep. It gives up eventually: a visitor still standing in
     the garden after five minutes is owed an answer, even if that answer is the
     Safari fallback.
     */
    private func fetchModel(draftUuid: String) async {
        model = .building
        let client = DraftClient()
        let deadline = Date().addingTimeInterval(Self.modelDeadline)

        while Date() < deadline {
            if Task.isCancelled { return }
            do {
                switch try await client.model(
                    draftUuid: draftUuid,
                    slug: invocation.slug,
                    language: invocation.language
                ) {
                case .ready(let url):
                    model = .ready(url)
                    return
                case .unavailable:
                    model = .unavailable
                    return
                case .building:
                    break
                }
            } catch {
                // A dropped poll is not a failed bake; the next one will find it.
            }
            try? await Task.sleep(nanoseconds: UInt64(Self.modelPollSeconds * 1_000_000_000))
        }

        model = .unavailable
    }

    /// How long a person will stand in a garden waiting for a veranda.
    private static let modelDeadline: TimeInterval = 300
    private static let modelPollSeconds: Double = 3


    // MARK: - Done

    private var done: some View {
        VStack(spacing: 20) {
            Spacer()

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(accent)

            if let saved {
                Text("\(metres(saved.widthCm)) × \(metres(saved.depthCm)) m")
                    .font(.system(size: 34, weight: .bold))
                // The MEASURED area, labelled as the veranda's — which it only is
                // while nothing was clamped. Printed under a capped
                // number it reads as broken arithmetic — "1.16 × 1.00 m" over
                // "0.6 m²" — so when the funnel could not sell what was
                // measured, the orange line below carries the real numbers and
                // this one steps aside rather than arguing with itself.
                if let area = saved.areaM2, saved.clamped != true {
                    Text(String(format: copy.resultArea, String(format: "%.1f", area)))
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.6))
                }
                if saved.clamped == true {
                    Text(
                        String(
                            format: copy.resultClamped,
                            metres(saved.rawWidthCm ?? saved.widthCm),
                            metres(saved.rawDepthCm ?? saved.depthCm)
                        )
                    )
                    .font(.caption)
                    .foregroundStyle(.orange)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 8)
                }
            }

            Text(message)
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.75))
                .multilineTextAlignment(.center)

            // The address this clip was actually opened with.
            //
            // Shown ONLY when there is no draft, which is the one failure a
            // person cannot diagnose from the outside: "we could not find the
            // design" is true whether the QR carried no `id`, the link was
            // hand-typed, or Xcode launched the clip with no invocation at all
            // — and those need three different fixes. A clip that dies takes
            // its console with it, and nobody is sitting next to the phone in
            // the garden. Untranslated on purpose: it is evidence, not a
            // sentence.
            if invocation.draftUuid == nil, invocation.expectsDraft {
                Text(invocation.sourceURL ?? "no invocation url")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.35))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 8)
                    .textSelection(.enabled)
            }

            Spacer()

            // The measurement made visible — the point of the whole exercise.
            //
            // Three states, in the order they actually happen. The model is
            // being built (minutes of headless WebGL, started the moment the
            // measurement saved); it has arrived and can stand in this very
            // spot; or it never will, and Safari can still show the design the
            // old way. The last is a fallback, not a feature: it drops the
            // visitor out of the session that knows where their terrace is.
            switch model {
            case .building:
                HStack(spacing: 10) {
                    ProgressView().tint(.white.opacity(0.6))
                    Text(copy.preparingModel)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.6))
                }
                .padding(.bottom, 4)

            case .ready(let url):
                Button {
                    if engine.place(modelAt: url) {
                        stage = .previewing
                    } else {
                        // The bytes arrived and RealityKit refused them. Say so
                        // by falling back rather than by doing nothing.
                        model = .unavailable
                    }
                } label: {
                    Text(copy.standItHere)
                        .font(.headline)
                        .foregroundStyle(onAccent)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(accent, in: RoundedRectangle(cornerRadius: 16))
                }
                .padding(.bottom, 4)

            case .unavailable, .idle:
                if let uuid = invocation.draftUuid,
                   let preview = AppContract.previewURL(
                       draftUuid: uuid,
                       language: invocation.language,
                       slug: invocation.slug
                   ),
                   !saveFailed {
                    Button {
                        openURL(preview)
                    } label: {
                        Text(copy.viewInGarden)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.8))
                    }
                    .padding(.bottom, 4)
                }
            }

            Button {
                engine.reset()
                saved = nil
                stage = .measuring
                engine.start()
            } label: {
                Text(copy.measureAgain)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.7))
            }
        }
        .padding(.horizontal, 26)
        .padding(.bottom, 24)
        .foregroundStyle(.white)
    }

    // MARK: - Preview

    /**
     The veranda, standing where it was measured.

     Almost no chrome on purpose: the visitor is walking around their own
     terrace looking at a roof, and every pixel of interface is in front of the
     thing they came here to see. Two ways out, both at the bottom, both out of
     the way.
     */
    private var preview: some View {
        ZStack {
            // Chrome only; the camera is mounted once in `body`.

            VStack {
                if let saved {
                    Text("\(metres(saved.widthCm)) × \(metres(saved.depthCm)) m")
                        .font(.footnote.weight(.semibold))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 8)
                        .background(.black.opacity(0.55), in: Capsule())
                        .padding(.top, 12)
                }

                Spacer()

                HStack(spacing: 12) {
                    Button {
                        engine.reset()
                        saved = nil
                        model = .idle
                        stage = .measuring
                        engine.start()
                    } label: {
                        Text(copy.measureAgain)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 18)
                            .padding(.vertical, 14)
                            .background(.black.opacity(0.55), in: Capsule())
                    }

                    Button {
                        stage = .done
                    } label: {
                        Text(copy.done)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(onAccent)
                            .padding(.horizontal, 24)
                            .padding(.vertical, 14)
                            .background(accent, in: Capsule())
                    }
                }
                .padding(.bottom, 28)
            }
            .foregroundStyle(.white)
        }
    }

    private var message: String {
        if saveFailed { return copy.notSaved }
        if invocation.draftUuid == nil {
            return invocation.expectsDraft ? copy.noDraftBody : copy.keptOnPhone
        }
        return invocation.fromQR ? copy.onDesktop : copy.saved
    }

    private func metres(_ cm: Int) -> String {
        String(format: "%.2f", Double(cm) / 100)
    }
}

/**
 The App Store app's memory: the last size somebody measured.

 Not a feature of the clip — a clip is gone by the time the visitor is back
 indoors, and it has nothing it may keep. The app is what turns "I measured
 something once" into something you can look up, which is also what makes it a
 real app rather than a wrapper around a clip.
 */
enum MeasurementStore {
    private static let key = "zinevu.lastMeasurement"

    static func remember(_ measurement: Measurement) {
        guard let data = try? JSONEncoder().encode(measurement) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }

    static var last: Measurement? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(Measurement.self, from: data)
    }
}
