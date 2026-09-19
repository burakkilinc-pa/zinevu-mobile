import ARKit
import ExpoModulesCore
import SwiftUI

/**
 The App Clip's terrace measurement, inside the Zinevu app.

 Two reasons it lives here too, and either would be enough:

 1. App Store Review Guideline 2.5.16(a): "all App Clip features and
    functionality must be included in the main app binary." The clip shipped
    inside this app on its own would be rejected for it.
 2. Once this app is installed, iOS opens IT instead of the clip for an App
    Clip invocation. A dealer who scans a customer's QR would otherwise land on
    the lead list with the URL thrown away — so the app hands that URL to the
    same flow the clip would have run (see `+native-intent.tsx`).

 Nothing is re-implemented. `Shared/` is symlinks to targets/ar-clip, so the
 clip and the app compile the same `MeasureFlowView` from the same files.
 */
public class ArMeasureModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ArMeasure")

    /// World tracking is the whole instrument; without it there is nothing to
    /// offer, so the button is not drawn rather than drawn and refused.
    Function("isSupported") { () -> Bool in
      ARWorldTrackingConfiguration.isSupported
    }

    /**
     Put the measuring flow on screen, full-screen, over whatever is showing.

     - `url`: an App Clip invocation (`https://app.zinevu.com/ar/…`) when the
       app was opened by one; the measurement then lands in that visitor's
       design exactly as it would from the clip. Nil when a dealer measures
       on-site from a lead — no design to write to, so the result stays on
       the screen.
     - `language`: the app's own UI language. A URL's `?lang=` still wins.

     Resolves `false` only when there is nothing to present from.
     */
    AsyncFunction("present") { (url: String?, language: String) -> Bool in
      let lang = Copy.normalize(language)
      let onSite = Invocation(slug: nil, draftUuid: nil, language: lang, fromQR: false)
      var invocation = onSite
      if let url, let parsed = URL(string: url) {
        invocation = Invocation.parse(parsed) ?? onSite.rejecting(parsed)
      }

      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        return false
      }

      let presented = PresentedController()
      let controller = UIHostingController(
        rootView: MeasureModal(invocation: invocation) { presented.controller?.dismiss(animated: true) }
      )
      presented.controller = controller
      controller.modalPresentationStyle = .fullScreen
      // The flow is drawn for a camera feed: dark, whatever the app is set to.
      controller.overrideUserInterfaceStyle = .dark
      presenter.present(controller, animated: true)
      return true
    }
    .runOnQueue(.main)
  }
}

/// The hosting controller has to exist before the view that closes it does.
private final class PresentedController {
  weak var controller: UIViewController?
}

/**
 `MeasureFlowView` with a way out.

 The clip never needed one — leaving a clip is the system's job — so the
 shared view has no close button, and it must not grow one: that would put a
 second exit into the clip. The app's full-screen modal is the one place that
 needs it, so it is added here, around the flow.

 Dismissing is also what stops ARKit: the flow's `body` runs
 `engine.stop()` on disappear.

 Top-leading because that corner is free on every stage — the point counter
 sits top-trailing and every control is at the bottom — and styled like that
 counter so it reads as part of the same chrome.
 */
private struct MeasureModal: View {
  let invocation: Invocation
  let close: () -> Void

  var body: some View {
    MeasureFlowView(invocation: invocation)
      .overlay(alignment: .topLeading) {
        Button(action: close) {
          Image(systemName: "xmark")
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: 36, height: 36)
            .background(.black.opacity(0.55), in: Circle())
        }
        .accessibilityLabel(Copy.of(invocation.language).close)
        .padding(.leading, 18)
        .padding(.top, 6)
      }
  }
}
