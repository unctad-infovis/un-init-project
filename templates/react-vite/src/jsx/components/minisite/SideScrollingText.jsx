import { useEffect, useRef, useState } from 'react';
import './SideScrollingText.css';

const getOpacity = translateX => {
  if (translateX > 30) return 1 - (translateX * 1.1 - 30) / 100;
  if (translateX < 0) return 1 + (translateX * 1.2) / 100;
  return 1;
};

const SideScrollingText = ({ header, texts }) => {
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

  return (
    <div className="container_side_scrolling_text" ref={containerRef} style={{ height: `${texts.length * 150}dvh` }}>
      {isScrolling && <div className="header">{header}</div>}
      {isScrolling && <div className="background" />}
      {isScrolling &&
        texts.map((text, index) => {
          const baseOffset = 100 * (index + 1) + 100;
          const translateX = baseOffset - scrollProgress * 450;
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
