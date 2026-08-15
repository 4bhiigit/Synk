# 📱 Capacitor Android APK & AAB Conversion Guide

This guide walks you through converting the **Nexus Chat** React (Vite) web application into an installable Android APK or production Google Play AAB using **Capacitor 6**.

---

## 1. Prerequisites
- **Node.js** (v18+) & **npm**
- **Android Studio** (Hedgehog or newer) with:
  - Android SDK Platform (API 33/34)
  - Android SDK Build-Tools
  - Android SDK Command-line Tools
  - Java JDK 17 or 21 (bundled with Android Studio)
- Set Environment Variables (Optional but recommended for CLI builds):
  - `ANDROID_HOME` = `C:\Users\<username>\AppData\Local\Android\Sdk`
  - Add to PATH: `%ANDROID_HOME%\platform-tools` and `%ANDROID_HOME%\cmdline-tools\latest\bin`

---

## 2. Capacitor Installation & Initialization

The required Capacitor packages are already included in `frontend/package.json`:
- `@capacitor/core`
- `@capacitor/cli`
- `@capacitor/android`

If you ever need to re-add them manually, run in `frontend/`:
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

Initialize Android platform:
```bash
# Build the production bundle first (creates the /dist directory)
npm run build

# Add the Android native project
npx cap add android
```

---

## 3. Capacitor Configuration (`capacitor.config.ts`)

Located at `frontend/capacitor.config.ts`:

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nexus.chat',
  appName: 'Nexus Chat',
  webDir: 'dist',
  server: {
    // Allows HTTP/WS connections during local LAN development
    cleartext: true,
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0b0f19'
  }
};

export default config;
```

---

## 4. Android Manifest & Permissions Configuration

Once you run `npx cap add android`, open the file:
`frontend/android/app/src/main/AndroidManifest.xml`

### A. Add Network & Internet Permissions
Add the following permission tags inside the `<manifest>` tag, above `<application>`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Permissions required for chat & real-time networking -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.VIBRATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true">
        ...
    </application>
</manifest>
```

> [!NOTE]
> `android:usesCleartextTraffic="true"` inside `<application>` allows connecting to your local machine IP (e.g. `http://192.168.1.X:8000`) or testing without an SSL certificate during development.

---

## 5. Build, Sync & Generate Android APK

### Step 1: Configure Backend URL for Mobile
In mobile emulators or real physical devices:
- `localhost` refers to the mobile phone itself!
- For **Android Emulator**: Use `http://10.0.2.2:8000` as the backend URL.
- For **Physical Android Device (same Wi-Fi)**: Use your computer's local IP address (e.g., `http://192.168.1.50:8000`).
- For **Production**: Use your Render backend URL (e.g. `https://nexus-chat-backend.onrender.com`).

Create `frontend/.env.production`:
```env
VITE_API_URL=https://your-backend-domain.onrender.com
VITE_WS_URL=wss://your-backend-domain.onrender.com
```

### Step 2: Build & Sync
```bash
# 1. Build Vite web bundle
npm run build

# 2. Sync web assets and plugins to Android directory
npx cap sync android
```

---

## 6. Generating the APK

### Option A: Using Android Studio (GUI - Recommended)
1. Open the Android project in Android Studio:
   ```bash
   npx cap open android
   ```
2. Wait for Gradle sync to complete.
3. To test on a connected phone or emulator:
   - Click the green **Run** button (`Shift + F10`).
4. To export a standalone **Debug APK**:
   - Go to menu: **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
   - Once built, click **locate** in the popup. The APK file will be at:
     `android/app/build/outputs/apk/debug/app-debug.apk`.
5. To generate a signed release APK or Google Play AAB:
   - Go to menu: **Build** > **Generate Signed Bundle / APK**.
   - Choose **Android App Bundle** (for Play Store) or **APK** (for direct distribution).
   - Create or choose your keystore and build.

---

### Option B: Command Line (Fast Terminal Build)
From the `frontend/android` directory:

```bash
# On Windows PowerShell / CMD:
cd android
.\gradlew assembleDebug

# Output APK path:
# android/app/build/outputs/apk/debug/app-debug.apk
```

You can now copy `app-debug.apk` directly to your phone via USB or WhatsApp and tap to install!
