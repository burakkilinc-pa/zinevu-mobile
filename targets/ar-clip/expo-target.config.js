/**
 * The AR veranda measurement, as an App Clip of THIS app.
 *
 * A customer scans a QR code in their veranda funnel, iOS fetches this bundle
 * in the background and puts it on screen — no App Store, no install, no
 * account. It measures the veranda with ARKit and writes the size onto the
 * configurator draft the funnel is already holding, which is the whole
 * contract; see AppContract.swift.
 *
 * It used to be an app of its own (`com.zinevu.measure`, "Zinevu AR Meten").
 * It moved here because an App Clip cannot ship without a parent app ON the
 * App Store, and that parent had never been submitted: a single-purpose AR
 * utility that exists to serve one website is exactly the shape Guideline 4.2
 * reviews hardest, and the whole feature was waiting behind that review. This
 * app is already approved and ships updates, so the clip rides along. Nothing
 * of the customer's experience is borrowed from the parent — the App Clip card
 * shows this target's own CFBundleDisplayName and the card configured in App
 * Store Connect.
 *
 * NOT React Native: the clip is pure SwiftUI + ARKit and must launch in the
 * time it takes to lower a phone from a QR code. No JS bundle is exported.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = () => ({
  type: 'clip',
  name: 'ZinevuMeasureClip',
  // The plugin assumes an App Clip is a React Native one and bolts the
  // "Bundle React Native code and images" phase onto it. This clip has no JS at
  // all, and that phase fails the build outright — it runs before anything is
  // compiled, so the symptom is a script error with no Swift in sight.
  exportJs: false,
  // What the customer reads on the App Clip card and under the icon.
  displayName: 'Zinevu Meten',
  // Leading dot = appended to this app's bundle id → com.zinevu.mobile.Clip.
  // Named verbatim on the web side too — `src/lib/appClip.js` and the
  // association document Apple fetches — so it cannot change here alone.
  bundleIdentifier: '.Clip',
  // The clip's own icon — the one the Smart App Banner and the App Library
  // show. Resolved relative to THIS folder, and it is the icon the measuring
  // app carried, so nothing a customer has already seen changes.
  icon: 'icon.png',
  // 16.4 rather than the 16.0 the code needs: Apple refuses to process an
  // upload whose CLIP asks for less, even when the parent app does not —
  //
  //   ITMS-90838: Invalid MinimumOSVersion ... has an invalid MinimumOSVersion
  //   value of '16.0' ... with a minimum OS of '16.4' or later.
  //
  // which also happens to be the parent app's own target, so the two now agree.
  deploymentTarget: '16.4',
  frameworks: ['ARKit', 'RealityKit'],
  entitlements: {
    // `appclips:` is what lets this domain hand a visitor the clip at all.
    //
    // Deliberately WITHOUT `applinks:` — here and on the parent app. An
    // `applinks` claim means "somebody who has the app installed opens the app
    // instead of the clip", and the app they would open is the dealer portal,
    // which cannot measure anything. Leaving it off is what makes a scanned QR
    // open the clip for everyone, dealers included.
    'com.apple.developer.associated-domains': ['appclips:app.zinevu.com'],
    // Apple refuses to build a clip whose parent identifier does not match the
    // app embedding it.
    'com.apple.developer.parent-application-identifiers': [
      '$(AppIdentifierPrefix)com.zinevu.mobile',
    ],
  },
});
