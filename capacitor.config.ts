import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alfaruqasri.ujian.browser',
  appName: 'EXAM AA Browser',
  webDir: 'dist-browser',
  server: {
    androidScheme: 'https',
    //
    cleartext: true,
    allowNavigation: ['*']
  },
  android: {
    overrideUserAgent: 'MosaExambro/2.0 (Android)'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: "#ffffff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      spinnerColor: "#059669"
    }
  }
};

export default config;
