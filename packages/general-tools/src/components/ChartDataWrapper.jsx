import { useEffect } from 'react';
import useIsVisible from '../helpers/UseIsVisible.js';

import './ChartDataWrapper.css';

const ChartDataWrapper = ({ chart_id }) => {
  const [setChartNode, isVisible, chartNode] = useIsVisible(0.4);

  useEffect(() => {
    if (!chartNode || chartNode.classList.contains('embed')) return;

    chartNode.classList.add('embed');
    const script = document.createElement('script');
    script.setAttribute('src', `https://datawrapper.dwcdn.net/${chart_id}/embed.js`);
    chartNode.appendChild(script);

    return () => {
      if (chartNode.contains(script)) {
        chartNode.removeChild(script);
      }
    };
  }, [chart_id, chartNode]);

  return (
    <figure className="container_chart_data_wrapper">
      {chart_id ? (
        <div className="parallax_container" style={{ opacity: isVisible ? '1' : '0', top: isVisible ? '0px' : '50px' }}>
          <div className="chart" ref={setChartNode} />
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
