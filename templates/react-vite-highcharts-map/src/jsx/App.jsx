import { useCallback, useEffect, useRef, useState } from 'react';

import Article from '../Article.mdx';

// General
// import BackToTop from './components/general/BackToTop.jsx';
// import ChartDataWrapper from './components/general/ChartDataWrapper.jsx';
// import Image from './components/general/Image.jsx';
// import ProgressBar from './components/general/ProgressBar.jsx';
// import Quote from './components/general/Quote.jsx';

// Map
import ChartMap from './components/ChartMap.jsx';

// Helpers.
import LoadFile from './helpers/LoadFile.js';

import './../styles/styles.css';

const components = {
  ChartMap
  // BackToTop,
  // ChartDataWrapper,
  // ChartFDIExplorer,
  // Header,
  // HeaderChapter,
  // Image,
  // ProgressBar,
  // Quote,
  // SideScrollingText
};

const App = ({ meta }) => {
  const appRef = useRef();

  const [data, setData] = useState(false);

  const fetchExternalData = useCallback(async () => {
    const data = {};

    data.map_data = await (await LoadFile('./assets/data/data.json')).json();
    data.topology = await (await LoadFile('./assets/data/worldmap-economies-54030.topo.json')).json();

    return data;
  }, []);

  useEffect(() => {
    const load = async () => {
      const result = await fetchExternalData();

      setData(result);
    };

    load();
  }, [fetchExternalData]);

  window.appRef = appRef;

  return (
    <div className="app" ref={appRef}>
      <Article components={components} data={data} meta={meta} />
    </div>
  );
};
export default App;
