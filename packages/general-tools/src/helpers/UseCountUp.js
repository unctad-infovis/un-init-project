import { useEffect, useRef, useState } from 'react';
import useIsVisible from './UseIsVisible';

export default function useCountUp(target, { duration = 1400, decimals = 0 } = {}) {
  const [ref, isVisible] = useIsVisible(0.4);
  const [current, setCurrent] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!isVisible || started.current) return;
    started.current = true;
    const t0 = performance.now();
    const step = ts => {
      const p = Math.min((ts - t0) / duration, 1);
      const eased = 1 - (1 - p) ** 3; // ease-out cubic
      setCurrent(parseFloat((eased * target).toFixed(decimals)));
      if (p < 1) requestAnimationFrame(step);
      else setCurrent(target);
    };
    requestAnimationFrame(step);
  }, [isVisible, target, duration, decimals]);

  return [current, ref];
}
