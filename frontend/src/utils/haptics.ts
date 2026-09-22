import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * Safely trigger haptic feedback. Works on mobile, silently fails on web.
 */
export const triggerHaptic = async (style: ImpactStyle = ImpactStyle.Light) => {
  try {
    await Haptics.impact({ style });
  } catch (e) {
    // Ignore error on web/unsupported platforms
  }
};

export const triggerHapticSelection = async () => {
  try {
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch (e) {
    // Ignore error
  }
};
