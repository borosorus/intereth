import React from 'react';
import ReactDOM from 'react-dom/client';
import CssBaseline from '@mui/material/CssBaseline';
import Bar from './components/Bar';
import { Web3OnboardProvider } from '@web3-onboard/react';
import { web3Onboard } from './onboard';
import App from './App';
import { ThemeProvider, createTheme } from '@mui/material';
import { blueGrey, deepOrange } from '@mui/material/colors';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

const theme = createTheme({
  palette: {
    primary: {
      main: blueGrey[500],
    },
    secondary: {
      main: deepOrange[500],
    },
  },
});

root.render(
  <React.StrictMode>
    <CssBaseline>
      <ThemeProvider theme={theme}>
        <Web3OnboardProvider web3Onboard={web3Onboard}>
          <header className="App-header">
            <Bar/>
          </header>
          <div className="App">
            <App/>
          </div>
        </Web3OnboardProvider>
      </ThemeProvider>
    </CssBaseline>
  </React.StrictMode>
);
