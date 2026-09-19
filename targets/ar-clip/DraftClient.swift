import Foundation

/**
 The dealer's identity, as far as this app is concerned.

 Fetched from the same public endpoint the funnel itself is built from, so the
 clip that opens on a customer's phone wears the dealer's colour and name
 rather than ours. Everything here is optional: an unknown slug, an offline
 phone or a dealer who set no accent colour all measure exactly the same, they
 just do it in the default orange.
 */
struct Branding {
    var dealerName: String?
    var accentHex: String?
    var widthBounds: DimensionBounds = .width
    var depthBounds: DimensionBounds = .depth
    /// The dealer's switch. False means this funnel does not offer measuring.
    var arMeasureEnabled: Bool = false
}

enum DraftClientError: Error {
    case badResponse(Int)
    case notFound
    case transport(Error)
}

/**
 Everything this app says to the server — two calls, both public, neither
 authenticated.

 There is no account and no token: a draft is addressed by an unguessable uuid
 that the QR code carried, exactly as it is from the browser. That is the whole
 reason a phone which has never seen this funnel can hand a measurement back to
 a desktop that is still standing on it.
 */
struct DraftClient {
    var session: URLSession = .shared

    // MARK: - Branding

    func branding(slug: String, language: String) async -> Branding {
        var branding = Branding()
        let url = AppContract.origin
            .appendingPathComponent("api/public/forms")
            .appendingPathComponent(slug)

        var request = URLRequest(url: url)
        request.setValue(language, forHTTPHeaderField: "Accept-Language")
        request.timeoutInterval = 6

        guard
            let (data, response) = try? await session.data(for: request),
            (response as? HTTPURLResponse)?.statusCode == 200,
            let body = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let config = body["data"] as? [String: Any]
        else {
            // Branding is decoration; measuring must never wait on it.
            return branding
        }

        branding.dealerName = config["dealer_name"] as? String
        branding.accentHex = (config["settings"] as? [String: Any])?["accent_color"] as? String
        branding.arMeasureEnabled = config["ar_measure"] as? Bool ?? false

        // The dealer's own min/max for the two sliders this measurement fills
        // in. Same blob, same keys as the web gate reads (`dimBounds`).
        if let overrides = config["option_overrides"] as? [String: Any],
           let dimensions = overrides["dimensions"] as? [String: Any] {
            branding.widthBounds = bounds(dimensions["width"], fallback: .width)
            branding.depthBounds = bounds(dimensions["depth"], fallback: .depth)
        }

        return branding
    }

    private func bounds(_ raw: Any?, fallback: DimensionBounds) -> DimensionBounds {
        guard let field = raw as? [String: Any] else { return fallback }
        return DimensionBounds(
            min: (field["min"] as? NSNumber)?.intValue ?? fallback.min,
            max: (field["max"] as? NSNumber)?.intValue ?? fallback.max
        )
    }

    // MARK: - Saving

    /**
     Hand the measurement to the draft.

     Writes `structure` as well as `measurement`, for the same reason the web
     does: the desktop applies the size itself, but a visitor who never goes
     back to the big screen must still find the veranda at their size when the
     draft is resumed. `structure` is deep-merged by the backend, so the height
     and mount type they already chose survive.
     */
    func save(
        measurement: Measurement,
        draftUuid: String,
        language: String
    ) async throws {
        let url = AppContract.origin
            .appendingPathComponent("api/public/configurator/drafts")
            .appendingPathComponent(draftUuid)

        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(language, forHTTPHeaderField: "Accept-Language")
        request.timeoutInterval = 12

        let payload = DraftPatch(
            currentStep: "dimensions",
            locale: language,
            payload: .init(
                structure: .init(
                    widthCm: measurement.widthCm,
                    depthCm: measurement.depthCm
                ),
                measurement: measurement
            )
        )
        request.httpBody = try JSONEncoder().encode(payload)

        let (_, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        switch status {
        case 200...299: return
        case 404, 410: throw DraftClientError.notFound
        default: throw DraftClientError.badResponse(status)
        }
    }

    // MARK: - The model

    /**
     Ask for the veranda itself.

     The server answers 200 with a USDZ or 202 with "not yet", and the second is
     the usual answer: building the model means compiling this design's whole
     3D scene in a headless browser with no GPU, which takes minutes. Nobody can
     hold a request open that long, so the first ask starts the work and the
     phone comes back for it.

     Asking is therefore also how you START it. There is no separate "please
     begin" call, which is deliberate — one door means the phone cannot get into
     a state where it is waiting for something nobody is making.
     */
    enum ModelAnswer {
        /// The file, on disk, ready for RealityKit.
        case ready(URL)
        /// Being baked. Ask again.
        case building
        /// This design will never have a model — an empty or vanished draft.
        case unavailable
    }

    func model(draftUuid: String, slug: String?, language: String) async throws -> ModelAnswer {
        var components = URLComponents(
            url: AppContract.origin
                .appendingPathComponent("api/public/configurator/drafts")
                .appendingPathComponent(draftUuid)
                .appendingPathComponent("model.usdz"),
            resolvingAgainstBaseURL: false
        )
        var query = [URLQueryItem(name: "lang", value: language)]
        if let slug, !slug.isEmpty {
            // The veranda is built to this dealer's own production cut list —
            // how many roof beams and posts a given width gets. Without it the
            // model in the garden has a beam count the offer does not sell.
            query.append(URLQueryItem(name: "slug", value: slug))
        }
        components?.queryItems = query

        guard let url = components?.url else { throw DraftClientError.notFound }

        var request = URLRequest(url: url)
        request.setValue(language, forHTTPHeaderField: "Accept-Language")
        // A bake is minutes away, so this call is never the slow part; it either
        // hands over a couple of megabytes or says "not yet" immediately.
        request.timeoutInterval = 30

        let (data, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0

        switch status {
        case 200:
            // Written to a real file: RealityKit loads a usdz from a URL, and
            // the extension is not decoration — it is how the format is chosen.
            let file = FileManager.default.temporaryDirectory
                .appendingPathComponent("veranda-\(draftUuid).usdz")
            try data.write(to: file, options: .atomic)
            return .ready(file)
        case 202:
            return .building
        case 404, 410:
            return .unavailable
        default:
            throw DraftClientError.badResponse(status)
        }
    }
}

private struct DraftPatch: Encodable {
    let currentStep: String
    let locale: String
    let payload: Payload

    enum CodingKeys: String, CodingKey {
        case currentStep = "current_step"
        case locale
        case payload
    }

    struct Payload: Encodable {
        let structure: Structure
        let measurement: Measurement
    }

    struct Structure: Encodable {
        let widthCm: Int
        let depthCm: Int

        enum CodingKeys: String, CodingKey {
            case widthCm = "width_cm"
            case depthCm = "depth_cm"
        }
    }
}
