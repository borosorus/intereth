import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import CssBaseline from '@mui/material/CssBaseline';
import Bar from './components/Bar';
import { Web3OnboardProvider } from '@web3-onboard/react';
import { web3Onboard } from './onboard';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <CssBaseline/>
    <Web3OnboardProvider web3Onboard={web3Onboard}>
      <header className="App-header">
        <Bar/>
      </header>
      <div className="App">
        <App/>
      </div>
    </Web3OnboardProvider>
  </React.StrictMode>
);
