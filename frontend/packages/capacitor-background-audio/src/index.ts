import { registerPlugin } from '@capacitor/core';
import type { BackgroundAudioPlugin } from './definitions';

export const BackgroundAudio = registerPlugin<BackgroundAudioPlugin>('BackgroundAudio', {
  web: () => ({
    enable: async () => {},
    disable: async () => {},
    update: async () => {},
    addListener: async () => ({ remove: async () => {} }),
    removeAllListeners: async () => {},
  }),
});

export * from './definitions';
