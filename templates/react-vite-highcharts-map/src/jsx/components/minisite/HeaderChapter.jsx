import { useEffect, useRef, useState } from 'react';

import ButtonAnchor from './../general/ButtonAnchor.jsx';
import Image from './../general/Image.jsx';

import './HeaderChapter.css';

function HeaderChapter({ pdf_url, image_url, subtitle, title }) {
  const headerRef = useRef(null);
  const [scrollPercentage, setScrollPercentage] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!headerRef.current) return;

      const rect = headerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      const triggerPoint = windowHeight * 0.5;

      const visibility = Math.min(Math.max((windowHeight - rect.top) / (windowHeight - triggerPoint), 0), 1);

      setScrollPercentage(visibility);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="container_chapter_header" ref={headerRef}>
      <div className="" style={{ opacity: scrollPercentage, transform: `translateX(${-(1 - scrollPercentage) * 30}%)` }}>
        <h3>{title}</h3>
        <h4>{subtitle}</h4>
      </div>
      {pdf_url && <ButtonAnchor className="chapter_download" text="Download" url={pdf_url} />}
      <Image alt={title} image_url={image_url} parallax={true} />
    </div>
  );
}

export default HeaderChapter;
