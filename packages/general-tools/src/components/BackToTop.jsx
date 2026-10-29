import { useEffect, useRef } from 'react';
import pinFallback from '../helpers/PinFallback.js';

import './BackToTop.css';

const BackToTop = ({ selector }) => {
  const containerRef = useRef(null);

  // Where the host page makes position: sticky impossible, the button is pinned by hand (the same offset as top in BackToTop.css)
  useEffect(() => pinFallback(containerRef.current, () => window.innerHeight - 65), []);

  const handleClick = selector => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.appRef.current.querySelector(selector)?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  };

  return (
    <div className="container_back_to_top" ref={containerRef}>
      <button aria-label="Back to top" type="button" onClick={() => handleClick(selector)}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
    </div>
  );
};

export default BackToTop;
