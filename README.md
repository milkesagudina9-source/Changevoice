# Voice Shift PWA — deploy-ready source

A small installable PWA for recording audio, trying voice effects, and exporting processed WAV audio. The interface and audio processing use local browser APIs; no external libraries, CDN assets, accounts, or audio uploads are used.

## Features
- Microphone recording via `getUserMedia` + `MediaRecorder`
- Presets: Normal, Baby, Higher, Deeper, Robot, Alien
- Pitch and speed sliders
- Offline Web Audio processing and WAV export
- PWA manifest, service worker, PNG icons (192, 512, maskable)
- Install button when the browser exposes `beforeinstallprompt`; browser-menu fallback text otherwise

## Deploy (required for PWA and microphone)
A PWA service worker and microphone access require a secure context: **HTTPS** in production, or `localhost` for local testing. Opening `index.html` directly as `file://` will not provide the full PWA/install/offline behavior.

### Option A — static host
1. Unzip this folder.
2. Upload the contents of `voice-shifter-pwa/` to any static HTTPS host (for example, GitHub Pages, Netlify, or Cloudflare Pages).
3. Open the deployed HTTPS address in Chrome/Edge.
4. Load it once while online, grant microphone permission, then use the browser's Install app / Add to Home screen option.

### Option B — test locally
From this folder, run a local static server such as:
`python -m http.server 8000`
Then visit `http://localhost:8000` in your browser. The microphone and service worker are permitted on localhost in modern browsers.

## Offline notes
- The app shell is cached after the first successful online load. Open the app once online before going offline.
- Recording, effects, and WAV encoding run locally. The app does not send audio anywhere.
- Browser/device support varies for recording formats. Current Chrome on Android is a good starting point.
- The “Higher” and “Deeper” effects are pitch-shifted by changing playback rate, so duration changes too; this is not formant-preserving studio voice conversion.
- Robot mode adds a tremolo-like modulation. Presets are playful effects, not accurate gender or age conversion.
- Recordings and rendered audio are held in the page's memory. Download any output you want to keep before closing/reloading the page.

## Files
- `index.html` — UI and PWA metadata links
- `styles.css` — responsive UI
- `app.js` — recording, presets, processing, WAV export, install prompt
- `manifest.webmanifest` — PWA manifest
- `sw.js` — offline app-shell cache
- `icons/` — PWA PNG icons

## Permissions and privacy
The microphone is accessed only after tapping Record and granting browser permission. Audio processing is local. If you deploy to a public URL, the hosting provider may collect ordinary web server logs, but this app has no analytics or telemetry.
