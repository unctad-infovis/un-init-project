import { resolveAsset } from '@unctad-infovis/general-tools/helpers/BasePath.js';
import { useEffect, useRef, useState } from 'react';
import './SideScrollingText.css';

// SLIDE_OFFSET: starting translateX (%) for each text panel before it scrolls in.
// SLIDE_RANGE: total scroll-driven translation range (%) across the full section height.
const SLIDE_OFFSET = 100;
const SLIDE_RANGE = 450;

const getOpacity = translateX => {
  if (translateX > 30) return 1 - (translateX * 1.1 - 30) / 100;
  if (translateX < 0) return 1 + (translateX * 1.2) / 100;
  return 1;
};

const SideScrollingText = ({ header, image_url, texts }) => {
  const containerRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
        setScrollProgress(Math.max(0, Math.min(1, progress)));
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const isScrolling = scrollProgress > 0 && scrollProgress < 1;
  const imgSrc = image_url ? resolveAsset(image_url) : undefined;

  return (
    <div className="container_side_scrolling_text" ref={containerRef} style={{ height: `${texts.length * 150}svh` }}>
      {isScrolling && <div className="header">{header}</div>}
      <div className="background" style={{ backgroundImage: imgSrc ? `url(${imgSrc})` : undefined, opacity: isScrolling ? undefined : 0 }} />
      {isScrolling &&
        texts.map((text, index) => {
          const baseOffset = SLIDE_OFFSET * (index + 2);
          const translateX = baseOffset - scrollProgress * SLIDE_RANGE;
          return (
            <div
              className="container_scrolling_text"
              key={text}
              style={{
                opacity: getOpacity(translateX),
                transform: `translateX(${translateX}%)`
              }}
            >
              <div className="text">{text}</div>
            </div>
          );
        })}
    </div>
  );
};

export default SideScrollingText;
