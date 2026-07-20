import { useCallback, useEffect, useRef, useState } from 'react';

import Article from '../Article.mdx';

// General
// import BackToTop from '@unctad-infovis/general-tools/components/BackToTop.jsx';
// import ChartDataWrapper from '@unctad-infovis/general-tools/components/ChartDataWrapper.jsx';
// import Image from '@unctad-infovis/general-tools/components/Image.jsx';
// import ProgressBar from '@unctad-infovis/general-tools/components/ProgressBar.jsx';
// import Quote from '@unctad-infovis/general-tools/components/Quote.jsx';

// Map
import ChartMap from './components/ChartMap.jsx';

// Helpers.
import LoadFile from '@unctad-infovis/general-tools/helpers/LoadFile.js';

import '@unctad-infovis/general-tools/styles/styles.css';

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
