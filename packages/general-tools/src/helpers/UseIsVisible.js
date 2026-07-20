import { useEffect, useState } from 'react';

/**
 * Returns [setNode, isVisible, node].
 * setNode is a callback ref — attach it via `ref={setNode}` on the element to observe.
 * isVisible flips true once the element enters the viewport (non-reversing).
 * threshold: how much of the element must be visible before triggering.
 */
const useIsVisible = (threshold = 0.3) => {
  const [node, setNode] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  const adjustedThreshold = window.innerWidth < 600 ? Math.min(0.3, threshold) : window.innerWidth < 800 ? Math.min(0.6, threshold) : threshold;

  useEffect(() => {
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(node); // fire once
        }
      },
      { threshold: adjustedThreshold }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [node, adjustedThreshold]);

  return [setNode, isVisible, node];
};

export default useIsVisible;
