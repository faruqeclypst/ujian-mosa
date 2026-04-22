import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alfaruqasri.ujian',
  appName: 'EXAM AA',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // url: 'https://exam.sman-modalbangsa.sch.id/',
    cleartext: true
  },
  android: {
    overrideUserAgent: 'MosaExambro/1.0 (Android)'
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
