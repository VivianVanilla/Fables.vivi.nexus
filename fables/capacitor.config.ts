import type { CapacitorConfig } from '@capacitor/cli';

// Native (Android) config only — the web build (npm run build) is the same
// artifact used both for the browser deploy and, via `npx cap sync android`,
// copied into android/app/src/main/assets/public for the native shell. No
// server.url override here on purpose: that's a live-reload-from-dev-machine
// dev convenience, and would make production APKs/AABs load your LAN dev
// server instead of the bundled assets — never wanted for a shipped build.
const config: CapacitorConfig = {
  appId: 'nexus.fables.vivi',
  appName: 'Fables',
  webDir: 'dist',
  // Near-black, theme-neutral — the real (user-customizable, see
  // shared/themes.ts) background only exists once React has mounted and
  // read the character's theme, so splash/status bar use one safe default
  // instead of guessing a theme that isn't resolved yet.
  backgroundColor: '#0a0a0f',
  plugins: {
    SplashScreen: {
      // Hidden manually from main.tsx once the app has actually mounted
      // (see SplashScreen.hide() call there) instead of a fixed duration —
      // avoids both a flash of blank white and an unnecessarily long hold
      // on a fast device.
      launchAutoHide: false,
      backgroundColor: '#0a0a0f',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      // Style.Dark = light icons/text, for the app's dark-by-default theme.
      // ThemeModal.tsx (light "Card Style"/"Background" pickers) can push a
      // different style/color at runtime via the same plugin — this is just
      // the pre-mount default.
      style: 'DARK',
      backgroundColor: '#0a0a0f',
      overlaysWebView: false,
    },
    Keyboard: {
      // Shrinks the webview instead of overlaying it, so a focused input
      // pinned near the bottom (chat composer, dice roller, stat editors)
      // isn't hidden behind the keyboard — same reason the mobile layout
      // pass earlier avoided fixed-position bottom bars where possible.
      resize: 'body',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    // Google's own guidance for edge-to-edge/gesture-nav devices — lets our
    // own CSS safe-area-inset handling (see index.css) own the insets
    // instead of two layers fighting over them.
    adjustMarginsForEdgeToEdge: 'auto',
  },
};

export default config;
