import type { PluginListenerHandle } from '@capacitor/core';

export interface BackgroundAudioOptions {
  title?: string;
  artist?: string;
  isPlaying?: boolean;
}

export interface MediaActionEvent {
  action: 'prev' | 'togglePlay' | 'next';
}

export interface BackgroundAudioPlugin {
  enable(options?: BackgroundAudioOptions): Promise<void>;
  disable(): Promise<void>;
  update(options?: BackgroundAudioOptions): Promise<void>;
  addListener(
    eventName: 'mediaAction',
    listenerFunc: (event: MediaActionEvent) => void
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}
