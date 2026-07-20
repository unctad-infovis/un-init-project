import { useRef } from 'react';

import Article from '../Article.mdx';

// General
// import BackToTop from '@unctad-infovis/general-tools/components/BackToTop.jsx';
// import ChartDataWrapper from '@unctad-infovis/general-tools/components/ChartDataWrapper.jsx';
// import Image from '@unctad-infovis/general-tools/components/Image.jsx';
// import ProgressBar from '@unctad-infovis/general-tools/components/ProgressBar.jsx';
// import Quote from '@unctad-infovis/general-tools/components/Quote.jsx';

// Minisite
// import Header from '@unctad-infovis/minisite-tools/components/Header.jsx';
// import HeaderChapter from '@unctad-infovis/minisite-tools/components/HeaderChapter.jsx';
// import SideScrollingText from '@unctad-infovis/minisite-tools/components/SideScrollingText.jsx';

import '@unctad-infovis/general-tools/styles/styles.css';

const components = {
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

  // useEffect(() => {
  //   const elements = appRef.current.querySelectorAll('.container_chapter p, .container_chapter ul, .container_chapter ol, .container_chapter h3, .container_chapter blockquote');

  //   // Options for the observer (when the p tag is 50% in the viewport)
  //   const options = {
  //     threshold: 0.5 // Trigger when 50% of the paragraph is visible
  //   };

  //   // Callback function for when the intersection occurs
  //   const observerCallback = entries => {
  //     entries.forEach(entry => {
  //       if (entry.isIntersecting) {
  //         // Add the visible class when the element is in view
  //         entry.target.classList.add('visible');
  //       }
  //     });
  //   };

  //   // Create an IntersectionObserver instance with the callback and options
  //   const observer = new IntersectionObserver(observerCallback, options);

  //   // Observe each paragraph
  //   for (const el of elements) {
  //     observer.observe(el);
  //   }
  //   setTimeout(() => {
  //     window.dispatchEvent(new Event('scroll'));
  //   }, 500); // A short delay ensures the DOM is ready
  // }, []);

  window.appRef = appRef;

  return (
    <div
      className="app"
      style={{
        // '--main-color': 'var(--un-color-green-dark)',
        // '--secondary-color': 'var(--un-color-green-text)'
      }}
      ref={appRef}
    >
      <Article components={components} meta={meta} />
    </div>
  );
};

export default App;
