import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alfaruqasri.ujian',
  appName: 'E-Ujian AA',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: 'https://exam.sman-modalbangsa.sch.id/',
    cleartext: true
  },
  android: {
    overrideUserAgent: 'MosaExambro/1.0 (Android)'
  }
};

export default config;
