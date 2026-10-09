import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.planificamaestro.app',
  appName: 'Planifica Maestro',
  webDir: 'client/dist',
  bundledWebRuntime: false,
  server: {
    url: 'https://planifica-maestro.israelmontas65.workers.dev',
    cleartext: false,
    androidScheme: 'https'
  }
};

export default config;
