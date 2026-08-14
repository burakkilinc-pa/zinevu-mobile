/**
 * The iOS notification service extension.
 *
 * iOS will not put a picture on a notification by itself. A push arrives as
 * text, and the only chance to add anything to it is a separate binary — this
 * one — that the system wakes for a few hundred milliseconds before the banner
 * is drawn, but only when the payload carries `mutable-content: 1`.
 * expo-notifications does not ship one, so it lives here.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = () => ({
  type: 'notification-service',
  name: 'ZinevuNotificationService',
  // Nothing to grant: the extension only reads the payload it was handed and
  // fetches one public image over HTTPS. No keychain, no app group, no shared
  // container — an entitlement we do not need is a provisioning profile that
  // can break a build for nothing.
  entitlements: {},
});
