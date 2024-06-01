import { Button, Container, FormControl, FormControlLabel, Input, InputLabel, MenuItem, Select, Switch } from "@mui/material";
import { useConnectWallet } from "@web3-onboard/react";
import { ethers } from "ethers";
import { useEffect, useState } from "react";
import { chains } from "../onboard";
import { DynamicContract } from "../App";

export default function ContractManager({addContract}: {addContract: (c: DynamicContract) => void}) {
    const [{wallet}, connect] = useConnectWallet();

    const [useBrowserWallet, setUseBrowserWallet] = useState(false);
    const [address, setAddress] = useState('');
    const [abi, setAbi] = useState('');
    const [providerIndex, setProviderIndex] = useState(0);
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
                    const signer = await (new ethers.BrowserProvider(walletState[0].provider)).getSigner();
                    setSigner(signer);
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
        if(useBrowserWallet){
            if(signer){
                const dynContract = {
                    contract: new ethers.BaseContract(address, new ethers.Interface(abi), signer),
                    isStatic: false,
                }
                addContract(dynContract);
            }
        }else {
            const provider = new ethers.JsonRpcProvider(chains[providerIndex].rpcUrl);
            const dynContract = {
                contract: new ethers.BaseContract(address, new ethers.Interface(abi), provider),
                isStatic: true,
            }
            addContract(dynContract);
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
            <Container sx={{width: 0.5, m: 1, display: 'flex', justifyContent: 'space-around'}}>
                {!useBrowserWallet && (
                <FormControl>
                    <InputLabel id="demo-simple-select-label">Rpc Provider</InputLabel>
                    <Select
                        labelId="demo-simple-select-label"
                        id="demo-simple-select"
                        value={providerIndex}
                        label="RpcProvider"
                        onChange={(event) => setProviderIndex(event.target.value as number)}
                    >
                        {chains.map((chain, index) => <MenuItem key={index} value={index}>{chain.label}</MenuItem>)}
                    </Select>
                </FormControl>)}
                <FormControlLabel control={<Switch checked={useBrowserWallet} onChange={() => tryChangeUseBrowserWallet()}/>} label="Use Browser Wallet" />
            </Container>
            <Button variant="contained" onClick={() => handleAddContract()}>Add Instance</Button>
        </Container>
    )
}