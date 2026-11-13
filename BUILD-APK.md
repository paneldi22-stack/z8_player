name: Build Expo APK

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Install dependencies
        run: npm install --legacy-peer-deps

      - name: Configure app.json safely
        run: |
          node << 'EOF'
          const fs = require("fs");
          const app = JSON.parse(fs.readFileSync("app.json", "utf8"));
          app.expo = app.expo || {};
          app.expo.name = "Z8 Player";
          app.expo.android = app.expo.android || {};
          if (!app.expo.android.package) {
            app.expo.android.package = "com.paneldi22.z8player";
          }
          const isValidPng = (p) => {
            if (!fs.existsSync(p)) return false;
            const buf = fs.readFileSync(p);
            return buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
          };
          if (isValidPng("assets/icon.png")) {
            app.expo.icon = "./assets/icon.png";
            app.expo.android.adaptiveIcon = {
              foregroundImage: "./assets/icon.png",
              backgroundColor: "#090D16"
            };
          } else {
            delete app.expo.icon;
            delete app.expo.splash;
            delete app.expo.android.adaptiveIcon;
            delete app.expo.android.splash;
            if (app.expo.web) delete app.expo.web.favicon;
          }
          fs.writeFileSync("app.json", JSON.stringify(app, null, 2));
          EOF

      - name: Prebuild Android
        run: npx expo prebuild --platform android --no-install

      - name: Allow HTTP IPTV Streams
        run: |
          node << 'EOF'
          const fs = require("fs");
          const p = "android/app/src/main/AndroidManifest.xml";
          let xml = fs.readFileSync(p, "utf8");
          if (!xml.includes("usesCleartextTraffic")) {
            xml = xml.replace("<application", '<application android:usesCleartextTraffic="true"');
          }
          fs.writeFileSync(p, xml);
          EOF

      - name: Build Release APK
        env:
          ORG_GRADLE_PROJECT_org.gradle.jvmargs: "-Xmx4096m -XX:MaxMetaspaceSize=1024m"
        run: cd android && chmod +x gradlew && ./gradlew assembleRelease

      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: z8_player-apk
          path: android/app/build/outputs/apk/release/app-release.apk
