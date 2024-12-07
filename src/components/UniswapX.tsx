import { Button, Container, FormControl, Input, InputLabel, Typography } from "@mui/material";
import { ethers as ethersOld } from "@uniswap/uniswapx-sdk/node_modules/ethers";
import { useMemo, useState } from "react";
import { DutchOrderBuilder, NonceManager, OrderValidation, OrderValidator } from "@uniswap/uniswapx-sdk";
import { WalletState } from "@web3-onboard/core";
import axios from "axios";

interface LimitOrder {
    inputToken: string;
    outputToken: string;
    inputAmount: string;
    outputAmount: string;
}
interface PostOrderData {
    encodedOrder: string;
    orderType: string;
    signature: string;
    chainId: number;
}
interface UniswapXProps{
    wallet: WalletState;
}
const CHAIN_ID = 1; //ONLY on ETH
const API_URL = "https://interface.gateway.uniswap.org/v2/limit-order";

export default function UniswapX({wallet}: UniswapXProps) {
    const [inputToken, setInputToken] = useState('');
    const [outputToken, setOutputToken] = useState('');
    const [inputAmount, setInputAmount] = useState('');
    const [outputAmount, setOutputAmount] = useState('');
    const provider = useMemo(() => (new ethersOld.providers.Web3Provider(wallet.provider)), []);
    const nonceManager = useMemo(() => {
        return new NonceManager(provider, CHAIN_ID); //Only on ETH for now
    }, [provider]);
    const orderBuilder = useMemo(() => (new DutchOrderBuilder(CHAIN_ID)), []);
    const account = wallet.accounts[0].address;

    const buildOrder = async () => {
        const now = Math.floor(Date.now() / 1000);
        const nonce = await nonceManager.useNonce(account);
        const order = orderBuilder
                        .decayStartTime(now)
                        .decayEndTime(now)
                        .deadline(now + 3600)//1h by def
                        .swapper(account)
                        .nonce(nonce)
                        .input({
                            token: inputToken,
                            startAmount: ethersOld.BigNumber.from(inputAmount),
                            endAmount: ethersOld.BigNumber.from(inputAmount),
                        })
                        .output({
                            token: outputToken,
                            startAmount: ethersOld.BigNumber.from(outputAmount),
                            endAmount: ethersOld.BigNumber.from(outputAmount),
                            recipient: account,
                        })
                        .build();

        // Sign the built order 
        const { domain, types, values } = order.permitData();
        const signature = await provider.getSigner()._signTypedData(domain, types, values);
        const serializedOrder = order.serialize();
        const validator = new OrderValidator(provider, 1);
        const validation = await validator.validate({order: order, signature: signature});
        if(validation === OrderValidation.OK){
            const data: PostOrderData = {
                encodedOrder: serializedOrder,
                orderType: 'Limit',
                signature: signature,
                chainId: CHAIN_ID,
            };
            const res = await axios.post(API_URL, data);
            console.log("Posted with res %s", res);
        }else{
            console.log("Validation failed %s", validation);
        }
    };

    return (
        <Container sx={{w: 1, border: '1px solid', borderRadius: '1px', mt: 1, mb: 1, p: 2}}>
            <Typography sx={{w: 1, textAlign: 'center'}}>UniswapX</Typography>
            <FormControl sx={{width: 0.5, m: 1}}>
                <InputLabel htmlFor={`inputToken`}>Input token</InputLabel>
                <Input id={`inputToken`} onChange={(e) => setInputToken(e.target.value)}/>
            </FormControl>
            <FormControl sx={{width: 0.5, m: 1}}>
                <InputLabel htmlFor={`inputAmount`}>Input amount</InputLabel>
                <Input id={`inputAmount`} onChange={(e) => setInputAmount(e.target.value)}/>
            </FormControl>
            <FormControl sx={{width: 0.5, m: 1}}>
                <InputLabel htmlFor={`outputToken`}>Output token</InputLabel>
                <Input id={`outputToken`} onChange={(e) => setOutputToken(e.target.value)}/>
            </FormControl>
            <FormControl sx={{width: 0.5, m: 1}}>
                <InputLabel htmlFor={`outputAmount`}>Output amount</InputLabel>
                <Input id={`outputAmount`} onChange={(e) => setOutputAmount(e.target.value)}/>
            </FormControl>
            <Button onClick={() => buildOrder().then((r) => console.log(r))} variant="contained" color="secondary">
                Send order
            </Button>
        </Container>
    );
}