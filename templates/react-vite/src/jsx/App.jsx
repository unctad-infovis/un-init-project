import { useEffect } from 'react';

import '../styles/styles.css';

// Load helpers.
// import formatNr from './helpers/FormatNr.js';
// import roundNr from './helpers/RoundNr.js';

// const appID = '#app-root-2026-test';

const App = () => {
	// Data states.
	// const [data, setData] = useState(false);

	useEffect(() => {
		// const data_file = `${(window.location.href.includes('unctad.org')) ? 'https://storage.unctad.org/2026-test/' : (window.location.href.includes('localhost:80')) ? './' : 'https://unctad-infovis.github.io/2026-test/'}assets/data/data.json`;
		try {
			console.log('test');
			// fetch(data_file)
			//   .then((response) => {
			//     if (!response.ok) {
			//       throw Error(response.statusText);
			//     }
			//     return response.text();
			//   })
			//   .then(body => setData(JSON.parse(body)));
		} catch (error) {
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
