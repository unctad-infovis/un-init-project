import React, { useState, useEffect } from 'react';
import './../styles/styles.less';

// Load helpers.
import formatNr from './helpers/formatNr.js';
import roundNr from './helpers/roundNr.js';

const App = () => {
  // Data states.
  const [data, setData] = useState(false);

  // Not used.
  // const [relativeToPopulation, setRelativeToPopulation] = useState(false);

  useEffect(() => {
    const data_file = (window.location.href.includes('unctad.org')) ? '/sites/default/files/data-file/2022-__PROJECT_NAME__.json' : './assets/data/data.json';
    try {
      // fetch(data_file)
      //   .then(response => response.text())
      //   .then(body => setData(JSON.parse(body)));
    }
    catch (error) {
      console.error(error);
    }
  }, []);

  return (
    <div className="app">
      <noscript>Your browser does not support JavaScript!</noscript>
    </div>
  );
};

export default App;
