import SwiftUI

/**
 What a scanned QR code opens.

 No App Store, no install, no account: iOS fetches this bundle in the
 background, hands it the URL that was scanned and puts it on screen. From the
 customer's side there is no download step at all — which is the entire reason
 the iPhone gets a native clip while Android measures in the browser.

 The URL is everything. It names the dealer (branding), the draft to write the
 measurement into, the language the visitor already chose on the funnel, and
 whether they are measuring for a configurator that is open on another screen.
 Receiving it lives in `InvocationRoot`, shared with the App Store app, which
 is handed the same URLs once it is installed.
 */
@main
struct ZinevuMeasureClipApp: App {
    var body: some Scene {
        WindowGroup {
            InvocationRoot(fallback: Invocation(
                slug: nil,
                draftUuid: nil,
                language: Copy.normalize(nil),
                fromQR: false
            ))
        }
    }
}
