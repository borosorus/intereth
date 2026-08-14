import React from 'react';
import ReactDOM from 'react-dom/client';
import CssBaseline from '@mui/material/CssBaseline';
import Bar from './components/Bar';
import { Web3OnboardProvider } from '@web3-onboard/react';
import { web3Onboard } from './onboard';
import App from './App';
import { ThemeProvider, createTheme, responsiveFontSizes, GlobalStyles } from '@mui/material';
import { blueGrey, deepOrange } from '@mui/material/colors';
import { WalletSessionProvider } from './wallet/WalletSessionContext';
import { TransactionPlanProvider } from './transaction-plan/context';
import { SimulationProvider } from './simulation/context';
import { TransactionPlanUiProvider } from './transaction-plan/uiContext';
import { WorkspaceModeProvider } from './workspace/context';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

const theme = responsiveFontSizes(createTheme({
  typography: {
    fontFamily: [
      'Roboto',
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      'sans-serif',
    ].join(','),
  },
  palette: {
    primary: {
      main: blueGrey[700],
    },
    secondary: {
      main: deepOrange[500],
    },
    background: {
      default: '#f4f7fb',
      paper: '#ffffff',
    },
  },
}));

root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          html: { height: '100%' },
          body: {
            minHeight: '100%',
            background: `radial-gradient(circle at top, ${blueGrey[50]} 0%, #f4f7fb 42%, #eef2f8 100%)`,
          },
          '#root': { minHeight: '100%' },
        }}
      />
      <Web3OnboardProvider web3Onboard={web3Onboard}>
        <WalletSessionProvider>
          <WorkspaceModeProvider>
            <TransactionPlanProvider>
              <SimulationProvider>
                <TransactionPlanUiProvider>
                  <Bar/>
                  <App/>
                </TransactionPlanUiProvider>
              </SimulationProvider>
            </TransactionPlanProvider>
          </WorkspaceModeProvider>
        </WalletSessionProvider>
      </Web3OnboardProvider>
    </ThemeProvider>
  </React.StrictMode>
);
