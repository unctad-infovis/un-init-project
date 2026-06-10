import { useEffect, useRef, useState } from 'react';

export default function RollingNumber({ target, duration = 1200, decimals = 0, inView = false }) {
  const [value, setValue] = useState(0);
  const firedRef = useRef(false);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!inView || firedRef.current) return;
    firedRef.current = true;
    let startTs = null;

    function tick(ts) {
      if (!startTs) startTs = ts;
      const t = Math.min((ts - startTs) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      setValue(decimals === 0 ? Math.round(eased * target) : parseFloat((eased * target).toFixed(decimals)));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [inView, target, duration, decimals]);

  return <>{decimals === 0 ? value : value.toFixed(decimals)}</>;
}
