import React, { /* useState, */useEffect } from 'react';
import '../styles/styles.less';

// Load helpers.
// import formatNr from './helpers/FormatNr.js';
// import roundNr from './helpers/RoundNr.js';

// const appID = '#app-root-__PROJECT_NAME__';

const App = () => {
  // Data states.
  // const [data, setData] = useState(false);

  useEffect(() => {
    const data_file = `${(window.location.href.includes('unctad.org')) ? 'https://storage.unctad.org/__PROJECT_NAME__/' : (window.location.href.includes('localhost:80')) ? './' : 'https://unctad-infovis.github.io/__PROJECT_NAME__/'}assets/data/data.json`;
    try {
      // fetch(data_file)
      //   .then((response) => {
      //     if (!response.ok) {
      //       throw Error(response.statusText);
      //     }
      //     return response.text();
      //   })
      //   .then(body => setData(JSON.parse(body)));
    }
    catch (error) {
      console.error(error);
    }
  }, []);

  return (
    <div className="app">
      {
        // Application
      }
    </div>
  );
};

export default App;
