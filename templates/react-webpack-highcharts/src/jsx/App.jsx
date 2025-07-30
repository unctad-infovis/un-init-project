import React, { useState, useEffect, useRef } from 'react';
import '../styles/styles.less';

// Load helpers.
// import formatNr from './helpers/FormatNr.js';
// import roundNr from './helpers/RoundNr.js';
import Chart from './components/Chart.jsx';

// const appID = '#app-root-__PROJECT_NAME__';

function App() {
  // Data states.
  const [data, setData] = useState(false);

  const chartRef = useRef(null);

  useEffect(() => {
    const data_file = `${(window.location.href.includes('unctad.org')) ? 'https://storage.unctad.org/__PROJECT_NAME__/' : (window.location.href.includes('localhost:80')) ? './' : 'https://unctad-infovis.github.io/__PROJECT_NAME__/'}assets/data/data.json`;
    try {
      fetch(data_file)
        .then((response) => {
          if (!response.ok) {
            throw Error(response.statusText);
          }
          return response.text();
        })
        .then(body => setData(JSON.parse(body)));
    } catch (error) {
      console.error(error);
    }
  }, []);

  return (
    <div className="app">
      <div className="title_container">
        <img src="https://static.dwcdn.net/custom/themes/unctad-2024-rebrand/Blue%20arrow.svg" className="logo" alt="UN Trade and Development logo" />
        <div className="title">
          <h3>After decades of decline, undernourishment still above pre-Covid levels</h3>
          <h4>
            Evolution of FAO Cereals Price Index, base 2014–2016, and prevalence of undernourishment, percentage, 2000–2024
          </h4>
        </div>
      </div>
      {
        data && <Chart data={[data]} idx="1" ref={chartRef} />
      }
    </div>
  );
}

export default App;
