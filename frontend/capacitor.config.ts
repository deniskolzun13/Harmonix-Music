import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.harmonix.player',
  appName: 'Harmonix',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    BackgroundAudio: {
      enabled: true,
    },
  },
};

export default config;
