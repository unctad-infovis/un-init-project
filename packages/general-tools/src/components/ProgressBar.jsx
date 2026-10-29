import { useEffect, useRef } from 'react';
import pinFallback from '../helpers/PinFallback.js';

import './ProgressBar.css';

function ProgressBar({ selector }) {
  const progressRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const chapters = window.appRef.current.querySelector(selector);

    if (!chapters || !progressRef.current) return;

    let ticking = false;

    const updateProgress = () => {
      const scrollTop = window.scrollY;

      const start = chapters.offsetTop;
      const height = chapters.offsetHeight;

      const progress = ((scrollTop - start) / height) * 100;

      progressRef.current.style.width = `${Math.min(Math.max(progress, 0), 100)}%`;

      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(updateProgress);
        ticking = true;
      }
    };

    updateProgress();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateProgress);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', updateProgress);
    };
  }, [selector]);

  // Where the host page makes position: sticky impossible, the bar is pinned by hand
  useEffect(() => pinFallback(containerRef.current, () => 0), []);

  return (
    <div className="container_progress_bar" ref={containerRef}>
      <div className="section">
        <div ref={progressRef} className="progress_bar" />
      </div>
    </div>
  );
}

export default ProgressBar;
