import ImageIO
import MobileCoreServices
import UniformTypeIdentifiers
import UserNotifications

/// Puts the veranda on the lock screen.
///
/// iOS hands this extension the push a moment before it draws the banner, and
/// gives it roughly 30 seconds to hand something back. Whatever happens in
/// here, the notification still has to arrive: every failure path below calls
/// the content handler with the untouched text rather than returning early, so
/// the worst case is the banner the dealer would have got anyway.
///
/// The picture is re-encoded rather than attached as downloaded. Our lead
/// renders are WebP (see App\Support\LeadPreviewImage on the API), and
/// UNNotificationAttachment accepts only JPEG, PNG and GIF — a .webp handed
/// over untouched is rejected and the banner silently loses its image. iOS can
/// *decode* WebP, so the fix is to decode whatever arrived and write a JPEG.
class NotificationService: UNNotificationServiceExtension {
  private var contentHandler: ((UNNotificationContent) -> Void)?
  private var bestAttemptContent: UNMutableNotificationContent?
  private var downloadTask: URLSessionDownloadTask?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    self.contentHandler = contentHandler
    self.bestAttemptContent = request.content.mutableCopy() as? UNMutableNotificationContent

    guard let content = bestAttemptContent else {
      contentHandler(request.content)
      return
    }

    guard let imageUrl = Self.imageUrl(in: request.content.userInfo) else {
      contentHandler(content)
      return
    }

    attachImage(from: imageUrl, to: content) { finished in
      contentHandler(finished)
    }
  }

  /// Called when the system is out of patience. Deliver the text.
  override func serviceExtensionTimeWillExpire() {
    downloadTask?.cancel()

    if let contentHandler, let bestAttemptContent {
      contentHandler(bestAttemptContent)
    }
  }

  /// Where Expo puts `richContent.image`.
  ///
  /// The push service nests the message under `body` and prefixes the key with
  /// an underscore, so the documented `richContent: { image }` arrives as
  /// `userInfo["body"]["_richContent"]["image"]`. The flatter shapes are
  /// checked too: this mapping is an implementation detail of a service we do
  /// not control, and the cost of being wrong is a picture that never appears
  /// with nothing in the logs to say why.
  private static func imageUrl(in userInfo: [AnyHashable: Any]) -> URL? {
    let containers: [[String: Any]] = [
      userInfo["body"] as? [String: Any],
      userInfo as? [String: Any],
    ].compactMap { $0 }

    for container in containers {
      let rich = (container["_richContent"] ?? container["richContent"]) as? [String: Any]

      if let string = rich?["image"] as? String,
         let url = URL(string: string),
         url.scheme?.hasPrefix("http") == true {
        return url
      }
    }

    return nil
  }

  private func attachImage(
    from url: URL,
    to content: UNMutableNotificationContent,
    completion: @escaping (UNNotificationContent) -> Void
  ) {
    let task = URLSession.shared.downloadTask(with: url) { location, _, _ in
      guard let location,
            let jpeg = Self.reencodeAsJpeg(at: location) else {
        completion(content)
        return
      }

      // A failed attachment must not cost us the notification, so the
      // attachment is applied only once it has actually been constructed.
      if let attachment = try? UNNotificationAttachment(identifier: "preview", url: jpeg, options: nil) {
        content.attachments = [attachment]
      }

      completion(content)
    }

    downloadTask = task
    task.resume()
  }

  /// Decode the download and write it back out as JPEG in the container iOS
  /// reads attachments from. Returns nil for anything that is not an image —
  /// an HTML error page served with a 200, most likely.
  private static func reencodeAsJpeg(at location: URL) -> URL? {
    guard let source = CGImageSourceCreateWithURL(location as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
      return nil
    }

    let target = URL(fileURLWithPath: NSTemporaryDirectory())
      .appendingPathComponent("\(UUID().uuidString).jpg")

    let type: CFString
    if #available(iOS 14.0, *) {
      type = UTType.jpeg.identifier as CFString
    } else {
      type = kUTTypeJPEG
    }

    guard let destination = CGImageDestinationCreateWithURL(target as CFURL, type, 1, nil) else {
      return nil
    }

    CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary)

    guard CGImageDestinationFinalize(destination) else {
      return nil
    }

    return target
  }
}
