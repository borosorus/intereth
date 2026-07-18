import Button from '@mui/material/Button';
import { shortenizeAddr } from '../helper';
import { useConnectWallet } from '@web3-onboard/react';
import { CircularProgress } from '@mui/material';

export default function ConnectionButton() {
    const[{wallet, connecting}, connect] = useConnectWallet();
    const address = wallet?.accounts?.[0]?.address;
    return (
        <Button
          variant="contained"
          color="secondary"
          onClick={() => connect()}
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
        </Button>);
}
