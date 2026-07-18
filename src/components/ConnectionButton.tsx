import Button from '@mui/material/Button';
import { shortenizeAddr } from '../helper';
import { useConnectWallet } from '@web3-onboard/react';
import { CircularProgress } from '@mui/material';
import { useState } from 'react';
import ErrorDialog from './ErrorDialog';
import { NormalizedError, normalizeError } from '../callUtils';

export default function ConnectionButton() {
    const[{wallet, connecting}, connect] = useConnectWallet();
    const address = wallet?.accounts?.[0]?.address;
    const [error, setError] = useState<NormalizedError | null>(null);

    const handleConnect = async () => {
      try {
        setError(null);
        await connect();
      } catch (error) {
        setError(normalizeError(error, "Wallet connection failed"));
      }
    };

    return (
      <>
        <Button
          variant="contained"
          color="secondary"
          onClick={handleConnect}
          sx={{
            minWidth: {xs: 108, sm: 132},
            px: {xs: 1.5, sm: 2},
            borderRadius: 999,
            textTransform: 'none',
            fontSize: {xs: '0.75rem', sm: '0.875rem'},
            fontWeight: 700,
            flex: '0 0 auto',
          }}
        >
            {connecting ? <CircularProgress size={18} color="inherit" /> : (address ? shortenizeAddr(address) : "Connect Wallet")}
        </Button>
        <ErrorDialog error={error} onClose={() => setError(null)} />
      </>
    );
}
