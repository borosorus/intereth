import { Box, Button, CircularProgress, Container, FormControl, FormControlLabel, FormHelperText, FormLabel, Grid, Input, InputAdornment, InputLabel, MenuItem, Paper, Select, Switch, TextField, Typography, styled } from "@mui/material";
import { useConnectWallet } from "@web3-onboard/react";
import { ethers } from "ethers";
import { useEffect, useMemo, useState } from "react";
import { chains } from "../onboard";
import { DynamicContract } from "../App";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

enum CustomRpcState {
    disabled,
    connecting,
    failed,
    connected
}

function renderCustomRpcProgress(state: CustomRpcState){
    switch(state){
        case CustomRpcState.failed:
            return <ErrorOutlineIcon />;
        case CustomRpcState.connecting:
            return <CircularProgress />;
        case CustomRpcState.connected:
            return <CheckCircleOutlineIcon />;
        default:
            return '';
    }
}

export default function ContractManager({addContract}: {addContract: (c: DynamicContract) => void}) {

    const [address, setAddress] = useState('');
    const [abi, setAbi] = useState('');

    const [providerIndex, setProviderIndex] = useState(0);

    //Custom rpc handling
    const [customRpc, setCustomRpc] = useState('');
    const [customRpcState, setCustomRpcState] = useState<CustomRpcState>(CustomRpcState.disabled);

    useEffect(() => {
        if(providerIndex === -1){
            if(customRpcState === CustomRpcState.disabled) setCustomRpcState(CustomRpcState.connecting);
            if(customRpc !== ''){
                const provider = new ethers.JsonRpcProvider(customRpc);
                provider._detectNetwork().then((n) => setCustomRpcState(CustomRpcState.connected), () => setCustomRpcState(CustomRpcState.failed));
            }
        } 
        else setCustomRpcState(CustomRpcState.disabled);
    }, [customRpc, providerIndex]);

    const [{wallet}, connect] = useConnectWallet();
    const [useBrowserWallet, setUseBrowserWallet] = useState(false);
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

    const canAddInstance = useMemo(() => {
        if(customRpcState !== CustomRpcState.disabled){
            return customRpcState === CustomRpcState.connected;
        }
        return true;
    }, [customRpcState]);

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
            }
        }
    }

    const handleAddContract = () => {
        if(useBrowserWallet){
            if(signer){
                const dynContract = {
                    contract: new ethers.BaseContract(address, new ethers.Interface(abi), signer),
                    isStatic: false,
                }
                addContract(dynContract);
            }
        }else {
            const rpcUrl = providerIndex === -1 ? customRpc : chains[providerIndex].rpcUrl;
            if(rpcUrl === ''){
                return;
            }
            const provider = new ethers.JsonRpcProvider(rpcUrl);
            const iface = abi === '' ? new ethers.Interface(["fallback(bytes calldata data) external view"]) : new ethers.Interface(abi);
            const dynContract = {
                contract: new ethers.BaseContract(address, iface, provider),
                isStatic: true,
            }
            addContract(dynContract);
        }
    }

    return(
            <Grid container spacing={2} padding={2} sx={{width: 0.5, m: 'auto', my: 2, border: 'solid 2px gray', borderRadius: 1, boxShadow: 1}} >
                <Grid item xs={12}>
                    <Typography sx={{w: 1, textAlign: 'center'}}>Add Contract</Typography>
                </Grid>
                <Grid item xs={12}>
                    <FormControl sx={{width: 0.9}}>
                        <InputLabel htmlFor="contract-target-address-label">Contract target address</InputLabel>
                        <Input id="contract-target-address" aria-describedby="contract-target-address-label" value={address} onChange={(e) => setAddress(e.target.value)}/>
                    </FormControl>
                </Grid>
                <Grid item xs={12}>
                    <FormControl sx={{width: 0.9}}>
                        <TextField
                            id="outlined-multiline-static"
                            label="Contract target abi"
                            multiline
                            rows={4}
                            value={abi} onChange={(e) => setAbi(e.target.value)}
                        />
                    </FormControl>
                </Grid>
                
                {!useBrowserWallet && (
                <Grid item xs={8}>
                    <FormControl>
                        <InputLabel id="rpc-provider-label">Rpc Provider</InputLabel>
                        <Select
                            labelId="rpc-provider-label"
                            id="rpc-provider-select"
                            value={providerIndex}
                            label="RpcProvider"
                            onChange={(event) => setProviderIndex(event.target.value as number)}
                        >
                            {chains.map((chain, index) => <MenuItem key={index} value={index}>{chain.label}</MenuItem>)}
                            <MenuItem key={-1} value={-1}>Custom</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>)}
                <Grid item xs={4}>
                    <FormControlLabel control={<Switch checked={useBrowserWallet} onChange={() => tryChangeUseBrowserWallet()}/>} label="Use Browser Wallet" />
                </Grid>
                {(providerIndex === -1 && !useBrowserWallet) &&
                (<Grid item xs={12}>
                    <FormControl sx={{width: 0.5, m: 1}}>
                        <TextField id="custom-rpc" label="Custom http RPC URL" error={customRpcState !== CustomRpcState.connected && customRpcState !== CustomRpcState.connecting} value={customRpc} onChange={(e) => setCustomRpc(e.target.value)} 
                        InputProps={{
                            endAdornment: 
                                <InputAdornment position="end">
                                    {providerIndex === -1 && (
                                    <Box >{renderCustomRpcProgress(customRpcState)}</Box>
                                )}
                                </InputAdornment>,
                    }}/>
                    </FormControl>
                </Grid>)}
                <Grid item xs={12}>
                    <Button variant="contained" color="secondary" disabled={!canAddInstance} onClick={() => handleAddContract()}>Add Instance</Button>
                </Grid>
            </Grid>
    )
}