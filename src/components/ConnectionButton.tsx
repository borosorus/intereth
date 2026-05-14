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
          sx={{minWidth: 132, borderRadius: 999, textTransform: 'none', fontWeight: 700}}
        >
            {connecting ? <CircularProgress size={18} color="inherit" /> : (address ? shortenizeAddr(address) : "Connect Wallet")}
        </Button>);
}
