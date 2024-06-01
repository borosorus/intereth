import { Button, Container, FormControl, FormControlLabel, Input, InputLabel, Switch } from "@mui/material";
import { useConnectWallet } from "@web3-onboard/react";
import { ethers } from "ethers";
import { useEffect, useState } from "react";

export default function ContractManager({addContract}: {addContract: (c: ethers.BaseContract) => void}) {
    const [{wallet}, connect] = useConnectWallet();

    const [useBrowserWallet, setUseBrowserWallet] = useState(false);
    const [address, setAddress] = useState('');
    const [abi, setAbi] = useState('');
    const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);

    useEffect(() => {
        if(wallet?.provider){
            (new ethers.BrowserProvider(wallet.provider)).getSigner()
                .then((signer) => setSigner(signer));
        }else {
            setSigner(null);
        }
     }, [wallet]);

    useEffect(() => {
        if(!signer && useBrowserWallet){
            setUseBrowserWallet(false);
        }
    }, [signer, useBrowserWallet]);

    const tryChangeUseBrowserWallet = async () => {
        if (useBrowserWallet) setUseBrowserWallet(false);
        else {
            if (signer) {
                setUseBrowserWallet(true);
            }
            else {
                const walletState = await connect();
                if(walletState[0]){
                    setUseBrowserWallet(true);
                }
                else{
                    //TODO message on checkbox connect to wallet failed
                }
            }
        }
    }

    const handleAddContract = () => {
        //TODO handle useBrowserWallet
        if(useBrowserWallet && signer){
            addContract(new ethers.BaseContract(address, new ethers.Interface(abi), signer))
        }
    }
    return(
        <Container sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', m: 2}}>
            <FormControl sx={{width: 0.5, m: 1}}>
                <InputLabel htmlFor="my-input">Contract target address</InputLabel>
                <Input id="my-input" aria-describedby="my-helper-text" value={address} onChange={(e) => setAddress(e.target.value)}/>
            </FormControl>
            <FormControl sx={{width: 0.5, m: 1}}>
                <InputLabel htmlFor="my-input">Contract target abi</InputLabel>
                <Input id="my-input" aria-describedby="my-helper-text" value={abi} onChange={(e) => setAbi(e.target.value)}/>
            </FormControl>
            <FormControlLabel control={<Switch checked={useBrowserWallet} onChange={() => tryChangeUseBrowserWallet()}/>} label="Use Browser Wallet" />

            <Button variant="contained" onClick={() => handleAddContract()}>Add Instance</Button>
        </Container>
    )
}