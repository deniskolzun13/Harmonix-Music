import { registerPlugin, PluginListenerHandle } from '@capacitor/core';

export interface AudioFocusPlugin {
  requestAudioFocus(): Promise<{ granted: boolean }>;
  abandonAudioFocus(): Promise<void>;
  addListener(
    eventName: 'audioFocusLoss' | 'audioFocusLossTransient' | 'audioFocusCanDuck' | 'audioFocusGain',
    listenerFunc: () => void
  ): Promise<PluginListenerHandle>;
}

export const AudioFocus = registerPlugin<AudioFocusPlugin>('AudioFocus', {
  web: () => ({
    requestAudioFocus: async () => ({ granted: true }),
    abandonAudioFocus: async () => {},
    addListener: async () => ({ remove: async () => {} }),
  }),
});
