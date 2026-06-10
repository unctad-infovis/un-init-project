import { useEffect, useRef, useState } from 'react';

/**
 * Returns [ref, isVisible].
 * isVisible flips true once the element enters the viewport (non-reversing).
 * threshold: how much of the element must be visible before triggering.
 */
const useIsVisible = (threshold = 0.3) => {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  threshold = window.innerWidth < 600 ? Math.min(0.3, threshold) : window.innerWidth < 800 ? Math.min(0.6, threshold) : threshold;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el); // fire once
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, isVisible];
};

export default useIsVisible;
