import Button from '@mui/material/Button';
import { shortenizeAddr } from '../helper';
import { useConnectWallet } from '@web3-onboard/react';

export default function ConnectionButton() {
    const[{wallet, connecting}, connect] = useConnectWallet();
    return (
        <Button variant="contained" color='secondary' onClick={() => connect()}>
            {connecting ? "Loading..." : (wallet ? shortenizeAddr(wallet.accounts[0].address) : "Connect")}
        </Button>);
}