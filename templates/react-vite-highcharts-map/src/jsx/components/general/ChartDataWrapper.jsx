import { useEffect, useRef } from 'react';
import { useIsVisible } from 'react-is-visible';

import './ChartDataWrapper.css';

const ChartDataWrapper = ({ chart_id }) => {
  const chartRef = useRef(null);
  const isVisible = useIsVisible(chartRef, { once: true });
  useEffect(() => {
    const container = chartRef.current;
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
  }, [chart_id]);

  return (
    <figure className="container_chart_data_wrapper">
      {chart_id ? (
        <div className="parallax_container" style={{ opacity: isVisible ? '1' : '0', top: isVisible ? '0px' : '50px' }}>
          <div className="chart" ref={chartRef} />
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
