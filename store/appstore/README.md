# App Store screenshots

Generated, not hand-designed. Edit the captions or the mocked screens in
`scripts/gen-store-screenshots.mjs` and re-run:

```
node scripts/gen-store-screenshots.mjs
```

It renders HTML with headless Google Chrome, so Chrome must be installed at
`/Applications/Google Chrome.app`. Type is Sora (from `@expo-google-fonts/sora`),
colours are the brand tokens in `tailwind.config.js` — ink `#082D36`, lime
`#E7FFA4`.

| Folder        | Size          | App Store slot          |
| ------------- | ------------- | ----------------------- |
| `iphone-6.5/` | 1242 × 2688   | iPhone 6.5" display     |
| `ipad-13/`    | 2064 × 2752   | iPad 13" display        |

Both slots take up to 10 images; five are supplied, uploaded in file-name order.
The `.build/` scratch directory (HTML + fonts) is disposable.
