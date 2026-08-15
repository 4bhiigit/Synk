import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Trigger authentic Apple Taptic Engine feedback.
 */
export const triggerHaptic = async (style = 'medium') => {
  try {
    if (style === 'light') {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (style === 'heavy') {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } else if (style === 'success') {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (style === 'error') {
      await Haptics.notification({ type: NotificationType.Error });
    } else {
      await Haptics.impact({ style: ImpactStyle.Medium });
    }
  } catch {
    // Browser fallback
    if (navigator.vibrate) {
      if (style === 'heavy' || style === 'error') {
        navigator.vibrate([40, 60, 40]);
      } else if (style === 'success') {
        navigator.vibrate([25, 40, 25]);
      } else {
        navigator.vibrate(20);
      }
    }
  }
};

export default triggerHaptic;
