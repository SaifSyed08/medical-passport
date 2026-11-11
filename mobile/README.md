# Tessera traveler app (Expo)

The traveler side of Tessera: Jordan Rivera's medical card with its QR code, health profile, documents, privacy controls and access log. It talks to the existing Workers backend at `/api/v1`.

**Demo only · synthetic data · not for clinical use.**

Expo SDK 58 (React Native 0.88), Expo Router, TypeScript.

## Run it

1. Install dependencies once:
   ```sh
   cd mobile
   npm install
   ```
2. Point the app at a backend. Copy `env.example` to `.env` and set `EXPO_PUBLIC_API_URL`:
   - **Deployed Workers URL:** `EXPO_PUBLIC_API_URL=https://<your-site-host>`. HTTPS, no tunnel needed. The deployed site must include the `/api/v1` code from this branch, so deploy it first.
   - **Your Mac, over Wi-Fi:** from the repo root run `npm run build` and then `npm run start:lan` (the built Worker on port 8787, reachable from the LAN). Set `EXPO_PUBLIC_API_URL=http://<your-mac-LAN-IP>:8787` (find the IP with `ipconfig getifaddr en0`). Phone and Mac must be on the same network.
   - **Simulator/emulator on the same Mac:** `npm start` in the repo root and `EXPO_PUBLIC_API_URL=http://127.0.0.1:8787` (iOS simulator) or `http://10.0.2.2:8787` (Android emulator).
3. **iPhone only: sign in to Expo (free account).** Since SDK 57, Expo Go on a physical iPhone only opens a dev-server project if Expo Go and the Expo CLI are signed in to the *same* Expo account. Create a free account at [expo.dev](https://expo.dev/signup), run `npx expo login` on your computer, and sign in to Expo Go with the same account (Settings/profile tab). Android devices, emulators and the iOS Simulator don't need this yet. See [Expo's troubleshooting page](https://docs.expo.dev/troubleshooting/expo-go-sign-in-required/).
4. Start Expo:
   ```sh
   npx expo start
   ```
   Scan the QR code with **Expo Go** (Android) or the Camera app (iOS).
   If your Wi-Fi blocks device-to-device traffic (common on campus networks), put the Mac and phone on a phone hotspot, and update `EXPO_PUBLIC_API_URL` to the Mac's new address. Press `i` / `a` for a simulator or emulator if you have Xcode or Android Studio.
5. On the login screen, choose:
   - **Continue as Jordan Rivera (sample data)**: the seeded traveler studying in Tokyo, or
   - **Start with a blank profile**: a fresh, empty profile for a user-test participant. It asks for a name, date of birth and destination country first. It lasts until you sign out (or 12 hours). There are no real accounts.

### Destination country and languages
The destination country sets the language doctors see on the emergency profile: English, Japanese, Spanish, French, Italian or German. Countries outside those fall back to English. Change it under **Privacy → Your trip** or **Health → Personal details**, where you can also override the language. The app's own UI language (English/Japanese) is separate. Anything a traveler types is shown to doctors in English with an **EN** marker; only the sample traveler's data has hand-written translations (see `../TRANSLATION_REVIEW.md`).

After changing `.env`, restart with `npx expo start --clear`. Metro also sometimes misses file changes without watchman; `--clear` fixes that too.

## Expo Go vs a development build

Everything runs in Expo Go, with these differences:

| Feature | Expo Go | Development build |
|---|---|---|
| Face ID (iOS) | Not available in Expo Go. Replace card and approve/deny fall back to a tap confirmation. | Real Face ID |
| Fingerprint / face unlock (Android) | Works | Works |
| Local notifications | Works (local only; no push is used) | Works |
| App icon, splash, app name | Expo Go's own | Tessera's |
| Save QR to Photos, share, document/photo pickers, brightness | Works | Works |

A development build needs `npx expo run:ios` (Xcode) or `npx expo run:android` (Android Studio), or EAS (`npx eas-cli@latest build --profile development`).

## What's where

- `src/app/`: screens (Expo Router). Tabs: Card, Health, Records, Privacy, Activity. Modals: full-screen QR (`show`), Wallet preview, emergency-profile preview, presenter tools, item and basics editors.
- `src/lib/`: API client, session (token in `expo-secure-store`), in-memory cache, activity polling and notifications, theme tokens, EN/JA strings.
- `src/components/`: UI kit ported from the web app's `app/passport.css` (same palette, serif/sans pairing, card themes).
- `../shared/tessera.ts`: API types shared with the backend, resolved through Metro `watchFolders` (no npm workspace).

## Presenter tools

**Long-press the Tessera logo** on any tab. You can simulate Dr. Tanaka viewing the emergency profile or requesting the full record, a wrong date of birth, or an unverified clinician; toggle auto-approve; and reset demo data. These stand in for the clinician web flow, which isn't built yet.

## Checks

```sh
npx tsc --noEmit
npx expo lint
npx expo-doctor
npx expo export --platform ios --platform android --output-dir dist-check   # proves both bundles build
```

`npx expo start --web` gives a browser preview for quick UI checks. On web, values are kept in memory instead of secure storage, and biometrics and notifications are unavailable.
