import React from 'react';

import { createRoot } from 'react-dom/client';

import App from './jsx/App.jsx';

const container = document.getElementById('__PROJECT_NAME__');
const root = createRoot(container);
root.render(<App />);