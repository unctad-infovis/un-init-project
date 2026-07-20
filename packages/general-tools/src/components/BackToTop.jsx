import './BackToTop.css';

const BackToTop = ({ selector }) => {
  const handleClick = selector => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.appRef.current.querySelector(selector)?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  };

  return (
    <div className="container_back_to_top">
      <button aria-label="Back to top" type="button" onClick={() => handleClick(selector)}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
    </div>
  );
};

export default BackToTop;
