export interface BackgroundAudioOptions {
  title?: string;
  artist?: string;
}

export interface BackgroundAudioPlugin {
  enable(options?: BackgroundAudioOptions): Promise<void>;
  disable(): Promise<void>;
  update(options?: BackgroundAudioOptions): Promise<void>;
}
