import { useEffect } from 'react';

/**
 * Calls handler when a pointerdown/touchstart occurs outside ref.current.
 * Pass active = false to skip attaching listeners (e.g. when a popup is already closed).
 */
const useClickOutside = (ref, handler, active = true) => {
  useEffect(() => {
    if (!active) return;

    const handleEvent = event => {
      if (ref.current && !ref.current.contains(event.target)) {
        handler(event);
      }
    };

    document.addEventListener('mousedown', handleEvent);
    document.addEventListener('touchstart', handleEvent);

    return () => {
      document.removeEventListener('mousedown', handleEvent);
      document.removeEventListener('touchstart', handleEvent);
    };
  }, [ref, handler, active]);
};

export default useClickOutside;
