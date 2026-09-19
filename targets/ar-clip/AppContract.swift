import SwiftUI

/**
 The three things this app agrees on with the website, and nothing else.

 Every value here has a counterpart in app.veranduo that must match it exactly:
 the bundle identifiers appear in `src/lib/appClip.js` and in the association
 document Apple fetches, and the host is the one that document is served from.
 A mismatch fails silently — no card appears and nothing is logged — so treat
 these as a contract, not as configuration.
 */
enum AppContract {
    /// Serves both the funnel and the public API the measurement is written to.
    static let host = "app.zinevu.com"

    static var origin: URL { URL(string: "https://\(host)")! }

    /// `https://app.zinevu.com/ar/{slug}?id={draft}&lang=nl&from=qr`
    static let invocationPathPrefix = "/ar"

    /**
     Where to send someone who has just measured and wants to SEE it.

     The mirror of `previewHandoffUrl()` in
     `features/configurator-3d/lib/ar/handoff.ts` — same page, same query, and
     it has to stay that way: that page bakes the draft into a USDZ and hands
     it to Quick Look, which is what puts the veranda in the garden at the size
     that was just measured. Leaving the clip for Safari to do it is deliberate
     for now; the clip carries no geometry of its own, and a veranda only
     exists once the configurator's shaders have built it.

     Locale IS in the path here, unlike the invocation URL: this one is an
     ordinary page and no App Clip prefix has to match it.
     */
    static func previewURL(draftUuid: String, language: String, slug: String?) -> URL? {
        var components = URLComponents(url: origin, resolvingAgainstBaseURL: false)
        components?.path = "/\(language)/augmented"
        var query = [URLQueryItem(name: "id", value: draftUuid)]
        if let slug, !slug.isEmpty {
            query.append(URLQueryItem(name: "slug", value: slug))
        }
        components?.queryItems = query

        return components?.url
    }
}

/**
 What a scanned QR code carries, once it has been taken apart.

 The clip is handed a URL and nothing else — no launch arguments, no stored
 session, no account. Everything it needs to do its job and hand the answer
 back has to be in here, which is why the parse is total: a URL missing the
 draft still measures, it just cannot save, and the screen says so rather than
 failing at the end.
 */
struct Invocation {
    /// The dealer whose funnel this measurement belongs to. Branding only.
    let slug: String?
    /// The configurator draft to write into. Absent = measure but don't save.
    let draftUuid: String?
    /// Two-letter language for the UI, defaulting to the funnel's own default.
    let language: String
    /// The visitor is measuring for a session open on another screen.
    let fromQR: Bool
    /// The URL this clip was opened with, kept verbatim for the one screen
    /// that has to explain why it could not find a design. See MeasureScreen.
    var sourceURL: String?
    /// A URL arrived, but not one of ours. See `expectsDraft`.
    var rejected = false

    /**
     Whether a missing draft is a failure — true only when one of OUR links
     opened the clip, because only our links ever promise a design.

     It used to be "always, for a clip", on the theory that a clip only exists
     because a URL opened it. Apple opens it without one of ours all the time:
     App Review and the App Store's own "Open" launch the default experience
     with `https://appclip.apple.com/id?p=com.zinevu.mobile.Clip`, and an App
     Clip Code with no registered URL does the same. Every one of those ended
     on "we could not find your design" with that Apple URL printed under it —
     an error screen, shown first to the one person deciding whether the clip
     ships. They now measure like the home-screen case: sizes kept on the phone.
     */
    var expectsDraft: Bool { sourceURL != nil && !rejected }

    /// A URL that arrived but is not ours to open. Kept rather than dropped,
    /// so a debugger can still read it off the invocation — but it no longer
    /// counts as a promise of a design.
    func rejecting(_ url: URL) -> Invocation {
        Invocation(
            slug: nil,
            draftUuid: nil,
            language: language,
            fromQR: false,
            sourceURL: "\(url.absoluteString) (rejected)",
            rejected: true
        )
    }

    static func parse(_ url: URL) -> Invocation? {
        guard url.host == AppContract.host else { return nil }

        let parts = url.path.split(separator: "/").map(String.init)
        // ["ar", "{slug}"] — anything else is not ours to open.
        guard parts.first == "ar" else { return nil }

        let query = URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems ?? []
        func value(_ name: String) -> String? {
            query.first { $0.name == name }?.value?.trimmingCharacters(in: .whitespaces)
        }

        return Invocation(
            slug: parts.count > 1 ? parts[1] : nil,
            draftUuid: value("id").flatMap { $0.isEmpty ? nil : $0 },
            language: Copy.normalize(value("lang")),
            fromQR: value("from") == "qr",
            sourceURL: url.absoluteString
        )
    }
}

/**
 The flow, holding whatever URL iOS hands over.

 The URL can arrive before or after the first frame, so the flow is remounted
 when it lands rather than reading it once at launch.

 And it arrives by TWO different doors, which is not obvious and cost a
 measurement: a scanned QR or an App Clip invocation is a universal link and
 lands in `onContinueUserActivity`, but Safari's Smart App Banner — the "OPEN"
 button a visitor who already has the parent app installed sees on /ar — hands
 its `app-argument` over as a plain `openURL` instead. Listening on only the
 first door meant that tap opened with no invocation at all: it measured
 happily, decided it had never been promised a draft, and told the visitor their
 terrace was "saved on this phone" while the configurator waiting on the other
 screen got nothing.
 */
struct InvocationRoot: View {
    @State private var invocation: Invocation

    init(fallback: Invocation) {
        _invocation = State(initialValue: fallback)
    }

    var body: some View {
        MeasureFlowView(invocation: invocation)
            // Remount when the invocation arrives: the branding fetch and the
            // language both hang off it, and neither is re-read once the view
            // is standing.
            .id(invocation.sourceURL ?? "pending")
            .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                guard let url = activity.webpageURL else { return }
                accept(url)
            }
            // The Smart App Banner's door. Same URL, different delivery.
            .onOpenURL { url in
                accept(url)
            }
    }

    /// One URL, wherever it came from — and a URL that is not ours is KEPT as a
    /// rejection rather than dropped, so it can still be read while debugging.
    private func accept(_ url: URL) {
        invocation = Invocation.parse(url) ?? invocation.rejecting(url)
    }
}
