import Foundation

/**
 Every word this app says, in the five languages the funnel is offered in.

 Deliberately a table in code rather than .strings files: the sentences here
 are the SAME sentences as `messages/<locale>.json` → `UI.AR.measure` on the website,
 and keeping them where a reviewer can see both halves at once is what stops
 the clip and the browser from describing the same three taps differently.

 The language arrives on the invocation URL (`?lang=`), not from the phone's
 own settings: the visitor already chose a language on the funnel, and the
 dealer's site may not even be offered in the one their phone is set to.
 */
struct Copy {
    let axisWidth, axisDepth, axisArea: String
    let close, undo, swap, done, retry: String
    let badgeReady: String
    let points: String          // "%d / %d punten"
    let hintScanning, hintFirst, hintSecond, hintThird, hintReady: String
    let introTitle, introSubtitle: String
    let step1, step2, step3: String
    let start, disclaimer: String
    let saving: String
    let resultArea: String      // "%@ m² terras"
    /**
     What was really measured, when the funnel could not sell it.

     Deliberately says "outside" rather than "larger". The clamp works in BOTH
     directions — a dealer's minimum is as real as their maximum, and a terrace
     measured at 56 cm deep is pushed UP to the smallest veranda they build. The
     sentence that only knew about "too big" told that visitor their half-metre
     strip was more than we supply, which is nonsense in the one place a person
     is checking whether to trust the number.
     */
    let resultClamped: String   // "%@ × %@ m"
    let saved, onDesktop, notSaved, measureAgain, openConfigurator: String
    /// The one button that turns a measurement into something you can look at.
    let viewInGarden: String
    /// While the server builds this design's model — minutes, not seconds.
    let preparingModel: String
    /// Put it down, right here, at the size that was just measured.
    let standItHere: String
    let errorTitle, errorBody, errorPermission: String
    let noDraftTitle, noDraftBody: String
    /// The App Store app opened from the home screen: no design was ever
    /// involved, so "we could not find it" would be a false alarm.
    let keptOnPhone: String

    static func normalize(_ raw: String?) -> String {
        let code = String((raw ?? "nl").prefix(2)).lowercased()
        return all[code] != nil ? code : "nl"
    }

    static func of(_ language: String) -> Copy {
        all[normalize(language)] ?? dutch
    }

    static let all: [String: Copy] = [
        "nl": dutch, "en": english, "de": german, "fr": french, "tr": turkish,
    ]

    static let dutch = Copy(
        axisWidth: "Breedte", axisDepth: "Diepte", axisArea: "Opp.",
        close: "Sluiten", undo: "Ongedaan", swap: "Wissel", done: "Klaar",
        retry: "Opnieuw proberen",
        badgeReady: "Gereed", points: "%d / %d punten",
        hintScanning: "Beweeg je telefoon rustig over de grond",
        hintFirst: "Zet het eerste punt tegen de muur",
        hintSecond: "Zet het tweede punt verderop langs de muur",
        hintThird: "Zet een punt aan de buitenrand van je terras",
        hintReady: "Klaar om op te slaan — of zet nog een punt",
        introTitle: "Meet je terras",
        introSubtitle: "Richt je camera op de grond en zet een paar punten. Wij rekenen de maten uit.",
        step1: "Beweeg je telefoon rustig heen en weer tot de grond herkend is.",
        step2: "Zet punt 1 en 2 langs de muur van je huis — dat is de breedte.",
        step3: "Zet nog minstens één punt aan de buitenrand voor de diepte.",
        start: "Start de meting",
        disclaimer: "Een AR-meting is een indicatie. De definitieve maten neemt de monteur bij je thuis op.",
        saving: "Maten worden opgeslagen…",
        resultArea: "%@ m² terras",
        resultClamped: "Je hebt %@ × %@ m gemeten. Dat valt buiten de maten die wij leveren, dus we houden de dichtstbijzijnde maat aan die wél past.",
        saved: "Je maten zijn opgeslagen in je ontwerp.",
        onDesktop: "Je maten staan nu op je computer — je ontwerp is bijgewerkt.",
        notSaved: "Noteer deze maten en vul ze zelf in de configurator in — opslaan is niet gelukt.",
        measureAgain: "Opnieuw meten",
        openConfigurator: "Verder in de configurator",
        viewInGarden: "Bekijk je veranda in je tuin",
        preparingModel: "Je veranda wordt klaargezet…",
        standItHere: "Zet je veranda hier neer",
        errorTitle: "De meting kon niet starten",
        errorBody: "Er ging iets mis bij het openen van de camera. Probeer het opnieuw.",
        errorPermission: "We hebben toegang tot je camera nodig om te kunnen meten. Sta dit toe in Instellingen en probeer het opnieuw.",
        noDraftTitle: "Meet je terras",
        noDraftBody: "Er hoort een ontwerp bij deze meting, maar we konden het niet vinden. Je kunt gewoon meten — noteer de maten zelf.",
        keptOnPhone: "Je maten zijn bewaard op deze telefoon."
    )

    static let english = Copy(
        axisWidth: "Width", axisDepth: "Depth", axisArea: "Area",
        close: "Close", undo: "Undo", swap: "Swap", done: "Done",
        retry: "Try again",
        badgeReady: "Ready", points: "%d / %d points",
        hintScanning: "Move your phone slowly across the ground",
        hintFirst: "Place the first point against the wall",
        hintSecond: "Place the second point further along the wall",
        hintThird: "Place a point at the outer edge of your terrace",
        hintReady: "Ready to save — or place another point",
        introTitle: "Measure your space",
        introSubtitle: "Point your camera at the ground and drop a few points. We work out the size.",
        step1: "Move your phone gently until the ground is recognised.",
        step2: "Place points 1 and 2 along your house wall — that is the width.",
        step3: "Place at least one more point at the outer edge for the depth.",
        start: "Start measuring",
        disclaimer: "An AR measurement is indicative. The final measurements are taken at your home.",
        saving: "Saving your measurements…",
        resultArea: "%@ m² of terrace",
        resultClamped: "You measured %@ × %@ m. That is outside the sizes we supply, so we kept the nearest size that does fit.",
        saved: "Your measurements have been saved to your design.",
        onDesktop: "Your measurements are on your computer now — your design has been updated.",
        notSaved: "Write these down and enter them in the configurator yourself — saving failed.",
        measureAgain: "Measure again",
        openConfigurator: "Continue in the configurator",
        viewInGarden: "See your veranda in your garden",
        preparingModel: "Your veranda is being prepared…",
        standItHere: "Place your veranda here",
        errorTitle: "Measuring could not start",
        errorBody: "Something went wrong opening the camera. Please try again.",
        errorPermission: "We need camera access to measure. Allow it in Settings and try again.",
        noDraftTitle: "Measure your space",
        noDraftBody: "There should be a design with this measurement, but we could not find it. You can still measure — just note the sizes down.",
        keptOnPhone: "Your measurements are kept on this phone."
    )

    static let german = Copy(
        axisWidth: "Breite", axisDepth: "Tiefe", axisArea: "Fläche",
        close: "Schließen", undo: "Rückgängig", swap: "Tauschen", done: "Fertig",
        retry: "Erneut versuchen",
        badgeReady: "Fertig", points: "%d / %d Punkte",
        hintScanning: "Bewegen Sie Ihr Handy langsam über den Boden",
        hintFirst: "Setzen Sie den ersten Punkt an die Wand",
        hintSecond: "Setzen Sie den zweiten Punkt weiter entlang der Wand",
        hintThird: "Setzen Sie einen Punkt an die Außenkante Ihrer Terrasse",
        hintReady: "Bereit zum Speichern — oder setzen Sie einen weiteren Punkt",
        introTitle: "Messen Sie Ihre Terrasse",
        introSubtitle: "Richten Sie die Kamera auf den Boden und setzen Sie ein paar Punkte. Die Maße berechnen wir.",
        step1: "Bewegen Sie Ihr Handy ruhig hin und her, bis der Boden erkannt ist.",
        step2: "Setzen Sie Punkt 1 und 2 entlang der Hauswand — das ist die Breite.",
        step3: "Setzen Sie mindestens einen weiteren Punkt an der Außenkante für die Tiefe.",
        start: "Messung starten",
        disclaimer: "Eine AR-Messung ist ein Richtwert. Die endgültigen Maße nimmt der Monteur bei Ihnen vor Ort.",
        saving: "Maße werden gespeichert…",
        resultArea: "%@ m² Terrasse",
        resultClamped: "Sie haben %@ × %@ m gemessen. Das liegt außerhalb unserer Maße, daher behalten wir das nächstliegende passende Maß.",
        saved: "Ihre Maße wurden in Ihrem Entwurf gespeichert.",
        onDesktop: "Ihre Maße sind jetzt auf Ihrem Computer — der Entwurf wurde aktualisiert.",
        notSaved: "Notieren Sie diese Maße und geben Sie sie selbst ein — das Speichern hat nicht geklappt.",
        measureAgain: "Erneut messen",
        openConfigurator: "Weiter im Konfigurator",
        viewInGarden: "Ihre Terrassenüberdachung im Garten ansehen",
        preparingModel: "Ihre Überdachung wird vorbereitet…",
        standItHere: "Überdachung hier aufstellen",
        errorTitle: "Die Messung konnte nicht gestartet werden",
        errorBody: "Beim Öffnen der Kamera ist etwas schiefgelaufen. Bitte versuchen Sie es erneut.",
        errorPermission: "Wir brauchen Zugriff auf Ihre Kamera. Erlauben Sie ihn in den Einstellungen und versuchen Sie es erneut.",
        noDraftTitle: "Messen Sie Ihre Terrasse",
        noDraftBody: "Zu dieser Messung gehört ein Entwurf, den wir nicht finden konnten. Sie können trotzdem messen — notieren Sie die Maße selbst.",
        keptOnPhone: "Ihre Maße sind auf diesem Handy gespeichert."
    )

    static let french = Copy(
        axisWidth: "Largeur", axisDepth: "Profondeur", axisArea: "Surface",
        close: "Fermer", undo: "Annuler", swap: "Inverser", done: "Terminé",
        retry: "Réessayer",
        badgeReady: "Prêt", points: "%d / %d points",
        hintScanning: "Déplacez lentement votre téléphone au-dessus du sol",
        hintFirst: "Placez le premier point contre le mur",
        hintSecond: "Placez le deuxième point plus loin le long du mur",
        hintThird: "Placez un point sur le bord extérieur de votre terrasse",
        hintReady: "Prêt à enregistrer — ou placez un autre point",
        introTitle: "Mesurez votre terrasse",
        introSubtitle: "Pointez la caméra vers le sol et placez quelques points. Nous calculons les dimensions.",
        step1: "Bougez doucement votre téléphone jusqu'à ce que le sol soit reconnu.",
        step2: "Placez les points 1 et 2 le long du mur de la maison — c'est la largeur.",
        step3: "Placez au moins un point de plus sur le bord extérieur pour la profondeur.",
        start: "Démarrer la mesure",
        disclaimer: "Une mesure en RA est indicative. Les dimensions définitives sont relevées chez vous.",
        saving: "Enregistrement des dimensions…",
        resultArea: "%@ m² de terrasse",
        resultClamped: "Vous avez mesuré %@ × %@ m. C'est en dehors des dimensions que nous fournissons, nous gardons donc la dimension la plus proche qui convient.",
        saved: "Vos dimensions ont été enregistrées dans votre projet.",
        onDesktop: "Vos dimensions sont maintenant sur votre ordinateur — votre projet a été mis à jour.",
        notSaved: "Notez ces dimensions et saisissez-les vous-même — l'enregistrement a échoué.",
        measureAgain: "Mesurer à nouveau",
        openConfigurator: "Continuer dans le configurateur",
        viewInGarden: "Voir votre pergola dans votre jardin",
        preparingModel: "Votre pergola est en préparation…",
        standItHere: "Placer votre pergola ici",
        errorTitle: "La mesure n'a pas pu démarrer",
        errorBody: "Un problème est survenu à l'ouverture de la caméra. Réessayez.",
        errorPermission: "Nous avons besoin d'accéder à votre caméra. Autorisez-le dans les Réglages puis réessayez.",
        noDraftTitle: "Mesurez votre terrasse",
        noDraftBody: "Un projet est associé à cette mesure, mais nous ne l'avons pas trouvé. Vous pouvez mesurer quand même — notez les dimensions.",
        keptOnPhone: "Vos dimensions sont conservées sur ce téléphone."
    )

    static let turkish = Copy(
        axisWidth: "Genişlik", axisDepth: "Derinlik", axisArea: "Alan",
        close: "Kapat", undo: "Geri al", swap: "Değiştir", done: "Tamam",
        retry: "Tekrar dene",
        badgeReady: "Hazır", points: "%d / %d nokta",
        hintScanning: "Telefonunu yavaşça zemin üzerinde gezdir",
        hintFirst: "İlk noktayı duvarın dibine koy",
        hintSecond: "İkinci noktayı duvar boyunca ileriye koy",
        hintThird: "Terasının dış kenarına bir nokta koy",
        hintReady: "Kaydetmeye hazır — ya da bir nokta daha koy",
        introTitle: "Alanını ölç",
        introSubtitle: "Kamerayı zemine doğrult ve birkaç nokta koy. Ölçüleri biz hesaplayalım.",
        step1: "Zemin tanınana kadar telefonu yavaşça hareket ettir.",
        step2: "1. ve 2. noktayı ev duvarı boyunca koy — bu genişliktir.",
        step3: "Derinlik için dış kenara en az bir nokta daha koy.",
        start: "Ölçmeye başla",
        disclaimer: "AR ölçümü yaklaşık bir değerdir. Kesin ölçüyü montaj ekibi yerinde alır.",
        saving: "Ölçüler kaydediliyor…",
        resultArea: "%@ m² teras",
        resultClamped: "%@ × %@ m ölçtün. Bu bizim ürettiğimiz ölçülerin dışında kaldığı için en yakın uyan ölçüyü aldık.",
        saved: "Ölçülerin tasarımına kaydedildi.",
        onDesktop: "Ölçülerin artık bilgisayarında — tasarımın güncellendi.",
        notSaved: "Bu ölçüleri not al ve konfigüratöre kendin gir — kaydetme başarısız oldu.",
        measureAgain: "Yeniden ölç",
        openConfigurator: "Konfigüratörde devam et",
        viewInGarden: "Verandanı bahçende gör",
        preparingModel: "Verandan hazırlanıyor…",
        standItHere: "Verandanı buraya kur",
        errorTitle: "Ölçüm başlatılamadı",
        errorBody: "Kamera açılırken bir sorun oldu. Lütfen tekrar dene.",
        errorPermission: "Ölçüm için kamera iznine ihtiyacımız var. Ayarlar'dan izin verip tekrar dene.",
        noDraftTitle: "Alanını ölç",
        noDraftBody: "Bu ölçüme ait bir tasarım olmalıydı ama bulamadık. Yine de ölçebilirsin — ölçüleri kendin not al.",
        keptOnPhone: "Ölçülerin bu telefonda saklandı."
    )
}
