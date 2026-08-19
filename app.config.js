const fs = require('fs');
const path = require('path');

const { expo } = require('./app.json');

/**
 * Everything the app is lives in `app.json`. This file exists for one key that
 * cannot: `android.googleServicesFile`.
 *
 * Android push needs `google-services.json` from the Firebase project whose
 * package is `com.zinevu.mobile`. It holds only public identifiers, so it can
 * live in the repo — and when it does, that copy is used and `expo run:android`
 * needs no setup. `GOOGLE_SERVICES_JSON` overrides it for anyone who would
 * rather keep the file out of git and ship it as an EAS file-type environment
 * variable (`eas env:create --name GOOGLE_SERVICES_JSON --type file`).
 *
 * When neither exists we leave the key off entirely rather than pointing at a
 * missing path: an absent key builds fine and silently has no push, whereas a
 * dangling one fails prebuild with a stack trace that never mentions Firebase.
 */
function googleServicesFile() {
  const fromEnv = process.env.GOOGLE_SERVICES_JSON;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const local = path.join(__dirname, 'google-services.json');
  if (fs.existsSync(local)) return './google-services.json';

  return null;
}

module.exports = () => {
  const file = googleServicesFile();

  if (!file) return expo;

  return {
    ...expo,
    android: { ...expo.android, googleServicesFile: file },
  };
};
