import { useEffect, useState } from 'react';

import './ButtonAnchor.css';

function ButtonAnchor({ className, text, url }) {
  const [exists, setExists] = useState(false);

  useEffect(() => {
    if (url.includes('https')) return;

    const check = () => {
      const el = document.querySelector(url);

      setExists(!!el);
    };

    check();

    const observer = new MutationObserver(() => {
      check();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, [url]);

  const handleClick = (event, selector) => {
    window.appRef.current.querySelector(selector)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
    event.preventDefault();
  };

  return (
    <div className="container_button_download">
      {url.includes('https') ? (
        <a aria-label={text} className={className} href={url} rel="noreferrer" target="_blank" type="button">
          {text}
        </a>
      ) : (
        exists && (
          <button aria-label={text} className={className} onClick={event => handleClick(event, url)} type="button">
            {text}
          </button>
        )
      )}
    </div>
  );
}

export default ButtonAnchor;
