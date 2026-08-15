import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nexus.chat',
  appName: 'Nexus Chat',
  webDir: 'dist',
  server: {
    // Allows loading cleartext / local endpoints on Android emulator/device during dev
    cleartext: true,
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0b0f19'
  }
};

export default config;
