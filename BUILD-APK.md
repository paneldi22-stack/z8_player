# Build the Z8 Player APK

You need a free Expo account (expo.dev) and Node 20 or newer. About 15 minutes, mostly waiting.

```bash
npm install
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

When it finishes, EAS prints a link and a QR code. Open the link on your phone, download the `.apk` and install it
(Android asks you to allow installs from your browser the first time).

- `preview` makes an APK you can install directly. `production` makes an `.aab` for the Play Store.
- Cleartext `http://` is allowed, because most providers don't use https.
- First run: tap "Get started", then "Use a playlist link" or "Sign in with your provider".
- This build keeps playlists in memory only, so they vanish when you close the app. Saving them is the next step.
- Not yet run on a real phone. If playback fails, send me the error text.
