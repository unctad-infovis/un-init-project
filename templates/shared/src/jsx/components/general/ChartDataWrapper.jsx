import { useEffect } from 'react';
import useIsVisible from './../../helpers/UseIsVisible';

import './ChartDataWrapper.css';

const ChartDataWrapper = ({ chart_id }) => {
  const [ref, isVisible] = useIsVisible(0.4);
  useEffect(() => {
    const container = ref.current;
    if (!container || container.classList.contains('embed')) return;

    container.classList.add('embed');
    const script = document.createElement('script');
    script.setAttribute('src', `https://datawrapper.dwcdn.net/${chart_id}/embed.js`);
    container.appendChild(script);

    return () => {
      if (container.contains(script)) {
        container.removeChild(script);
      }
    };
  }, [chart_id, ref.current]);

  return (
    <figure className="container_chart_data_wrapper">
      {chart_id ? (
        <div className="parallax_container" style={{ opacity: isVisible ? '1' : '0', top: isVisible ? '0px' : '50px' }}>
          <div className="chart" ref={ref} />
          <noscript>
            <img src={`https://datawrapper.dwcdn.net/${chart_id}/full.png`} alt="" />
          </noscript>
        </div>
      ) : (
        <div className="warning">Chart ID is empty or missing</div>
      )}
    </figure>
  );
};

export default ChartDataWrapper;
