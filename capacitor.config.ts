import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'examku.alfaprojects.com.local',
  appName: 'EXAMKU Local',
  webDir: 'dist',
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
    CapacitorHttp: {
      enabled: true
    },
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
