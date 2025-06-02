// src/main.jsx

// Import React's StrictMode component, which helps highlight potential problems
// in an application by running additional checks and warnings for its descendants.
import { StrictMode } from 'react';

// Import createRoot from ReactDOM to initialize the React application in the DOM.
// createRoot is the modern method (React 18+) for rendering React apps, replacing ReactDOM.render.
import { createRoot } from 'react-dom/client';

// Import the global CSS file for base styles (e.g., resets, typography, utility classes).
import './index.css';

// Import the root App component, which contains the entire application’s routes and UI.
import App from './App.jsx';

// Find the HTML element with id="root" in index.html. This is where React will mount our app.
const container = document.getElementById('root');

// Call createRoot with the container element to create a root React node.
// This enables the new concurrent features in React 18.
const root = createRoot(container);

// Render the application inside <StrictMode> to enable development-only checks and warnings.
// StrictMode does not affect production builds—it’s purely a development tool to catch issues early.
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
