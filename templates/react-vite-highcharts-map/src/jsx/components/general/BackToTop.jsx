import './BackToTop.css';

const BackToTop = ({ selector }) => {
  const handleClick = selector => {
    window.appRef.current.querySelector(selector)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  };

  return (
    <div className="container_back_to_top">
      <button type="button" onClick={() => handleClick(selector)}>
        Back to top
      </button>
    </div>
  );
};

export default BackToTop;
