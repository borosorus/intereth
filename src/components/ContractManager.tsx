import { Button, Container, FormControl, FormControlLabel, FormGroup, Input, InputLabel, Switch } from "@mui/material";
import { useConnectWallet } from "@web3-onboard/react";
import { ethers } from "ethers";
import { useEffect, useMemo, useState } from "react";

export default function ContractManager({addContract}: {addContract: (c: ethers.Contract) => void}) {
    const [{wallet}, connect] = useConnectWallet();

    const [useBrowserWallet, setUseBrowserWallet] = useState(false);
    const [address, setAddress] = useState('');
    const [abi, setAbi] = useState('');

    const isConnected = useMemo(() => !!wallet, [wallet]);

    useEffect(() => {
        if(!isConnected && useBrowserWallet){
            setUseBrowserWallet(false);
        }
    }, [isConnected, useBrowserWallet]);

    const tryChangeUseBrowserWallet = async () => {
        if (useBrowserWallet) setUseBrowserWallet(false);
        else {
            if (isConnected) {
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
        const provider = new ethers.BrowserProvider(wallet!.provider);
        const contract = new ethers.Contract(address, new ethers.Interface(abi), provider);
        addContract(contract);
    }
    return(
        <Container sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', m: 2, border: 'solid'}}>
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