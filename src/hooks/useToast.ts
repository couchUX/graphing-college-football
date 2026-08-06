import { useCallback, useState } from 'react';

/**
 * Toast state, shared by every page that copies embeds or links.
 * Replaces the showToast/toastMessage/setShowToast triplet that each page
 * used to declare for itself.
 */
export const useToast = () => {
  const [message, setMessage] = useState<string>('');
  const [isVisible, setIsVisible] = useState<boolean>(false);

  const showToast = useCallback((text: string) => {
    setMessage(text);
    setIsVisible(true);
  }, []);

  const hideToast = useCallback(() => setIsVisible(false), []);

  return { message, isVisible, showToast, hideToast };
};
