import { Box, Button, Container, FormControl, Input, InputLabel, MenuItem, Select, Typography } from "@mui/material";
import { ethers as ethersOld } from "@uniswap/uniswapx-sdk/node_modules/ethers";
import { useEffect, useMemo, useState } from "react";
import { DutchOrder, DutchOrderBuilder, NonceManager, OrderValidation, OrderValidator } from "@uniswap/uniswapx-sdk";
import { WalletState } from "@web3-onboard/core";
import axios from "axios";
import { MockERC20__factory } from "@uniswap/uniswapx-sdk/dist/src/contracts";
import { formatEther, formatUnits, parseUnits } from "ethers";

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
    const [duration, setDuration] = useState(3600);

    const [builtOrder, setBuiltOrder] = useState<DutchOrder | undefined>(undefined);

    const provider = useMemo(() => (new ethersOld.providers.Web3Provider(wallet.provider)), []);

    const nonceManager = useMemo(() => {
        return new NonceManager(provider, CHAIN_ID); //Only on ETH for now
    }, [provider]);

    const buildOrder = useMemo(() => async () => {
        const now = Math.floor(Date.now() / 1000);
        const account = wallet.accounts[0].address;

        const nonce = await nonceManager.useNonce(account);

        const decimalsInput = ethersOld.BigNumber.from(10).pow(ethersOld.BigNumber.from(await MockERC20__factory.connect(inputToken, provider).decimals()));
        const decimalsOutput = ethersOld.BigNumber.from(10).pow(ethersOld.BigNumber.from(await MockERC20__factory.connect(outputToken, provider).decimals()));
        const inputAmountD = ethersOld.BigNumber.from(inputAmount).mul(decimalsInput);
        const outputAmountD = ethersOld.BigNumber.from(outputAmount).mul(decimalsOutput);

        const orderBuilder = new DutchOrderBuilder(CHAIN_ID);
        const order = orderBuilder
                        .decayStartTime(now)
                        .decayEndTime(now)
                        .deadline(now + duration)//1h by def
                        .swapper(account)
                        .nonce(nonce)
                        .input({
                            token: inputToken,
                            startAmount: inputAmountD,
                            endAmount: inputAmountD,
                        })
                        .output({
                            token: outputToken,
                            startAmount: outputAmountD,
                            endAmount: outputAmountD,
                            recipient: account,
                        })
                        .build();

        setBuiltOrder(order);
    }, [provider, nonceManager, inputAmount, outputAmount, wallet, duration]);

    const [orderDesc, setOrderDesc] = useState('');
    useEffect(() => {
        if(builtOrder){
            (async () => {
                const input = builtOrder.info.input;
                const output = builtOrder.info.outputs[0];
                const decimalsInput = await MockERC20__factory.connect(input.token, provider).decimals();
                const decimalsOutput = await MockERC20__factory.connect(output.token, provider).decimals();
                const inputName = await MockERC20__factory.connect(input.token, provider).name();
                const outputName = await MockERC20__factory.connect(output.token, provider).name();
                const inOutPrice = formatUnits(input.startAmount.mul(parseUnits('1', decimalsOutput)).div(output.startAmount).toString(), decimalsInput);
                const outInPrice = formatUnits(output.startAmount.mul(parseUnits('1', decimalsInput)).div(input.startAmount).toString(), decimalsOutput);
                setOrderDesc(`
                    Buying ${output.startAmount.div(parseUnits('1', decimalsOutput))} ${outputName} at a price of ${inOutPrice} ${inputName} per ${outputName}.
                    Selling ${input.startAmount.div(parseUnits('1', decimalsInput))} ${inputName} at a price of ${outInPrice} ${outputAmount} per ${inputName}.
                    `);
            })()
        } else {
            setOrderDesc('');
        }
    }, [builtOrder, provider]);

    const sendOrder = useMemo(() => async () => {
        if(!builtOrder) return;
        // Sign the built order 
        const { domain, types, values } = builtOrder.permitData();
        try{
            const signature = await provider.getSigner()._signTypedData(domain, types, values);
            const serializedOrder = builtOrder.serialize();
            const validator = new OrderValidator(provider, 1);
            const validation = await validator.validate({order: builtOrder, signature: signature});

            if(validation === OrderValidation.OK){
                console.log("Validation succeeded");
                const data: PostOrderData = {
                    encodedOrder: serializedOrder,
                    orderType: 'Limit',
                    signature: signature,
                    chainId: CHAIN_ID,
                };
                const res = await axios.post(API_URL, data);
                console.log("Posted with res %s", res);
                setBuiltOrder(undefined);
            }else{
                setOrderDesc(`Validation failed ${validation}`);
            }
        } catch(e){
            console.error(e);
        }

    }, [builtOrder, provider]);

    return (
        <Container sx={{w: 1, border: '1px solid', borderRadius: '1px', mt: 1, mb: 1, p: 2}}>
            <Typography sx={{w: 1, textAlign: 'center'}}>UniswapX</Typography>
            <FormControl sx={{width: 0.5, m: 1}}>
                <InputLabel htmlFor={`inputToken`}>Input token</InputLabel>
                <Input id={`inputToken`} onChange={(e) => setInputToken(e.target.value)}/>
            </FormControl>
            {builtOrder && (
                <FormControl sx={{width: 0.4, m: 1}}>
                    <Typography sx={{m: 'auto'}}>{orderDesc}</Typography>
                </FormControl>
            )}
            <FormControl sx={{width: 0.5, m: 1}}>
                <InputLabel htmlFor={`inputAmount`}>Input amount</InputLabel>
                <Input id={`inputAmount`} onChange={(e) => setInputAmount(e.target.value)}/>
            </FormControl>
            <FormControl sx={{width: 0.5, m: 1}}>
                <InputLabel htmlFor={`outputToken`}>Output token</InputLabel>
                <Input id={`outputToken`} onChange={(e) => setOutputToken(e.target.value)}/>
            </FormControl>
            {builtOrder && (
                <FormControl sx={{width: 0.4, m: 1}}>
                    <Button onClick={() => setBuiltOrder(undefined)} variant="contained" color="secondary">
                    Cancel order
                    </Button>
                </FormControl>
            )}
            <FormControl sx={{width: 0.5, m: 1}}>
                <InputLabel htmlFor={`outputAmount`}>Output amount</InputLabel>
                <Input id={`outputAmount`} onChange={(e) => setOutputAmount(e.target.value)}/>
            </FormControl>
            {builtOrder && (
                <FormControl sx={{width: 0.4, m: 1}}>
                    <Button onClick={() => sendOrder()} variant="contained" color="secondary">
                    Send order
                    </Button>
                </FormControl>
            )}
            <FormControl sx={{width: 0.5, m: 1}}>
                <InputLabel id="label-select-duration">Duration</InputLabel>
                <Select
                    labelId="label-select-duration"
                    id="select-duration"
                    value={duration}
                    label="Duration"
                    onChange={(d) => setDuration(d.target.value as number)}
                >
                    <MenuItem value={3600}>1 hour</MenuItem>
                    <MenuItem value={86400}>1 day</MenuItem>
                    <MenuItem value={604800}>1 week</MenuItem>
                    <MenuItem value={2419200}>1 month</MenuItem>
                </Select>
            </FormControl>
            <FormControl sx={{width: 0.5, m: 1}}>
                <Button onClick={() => buildOrder()} disabled={!!builtOrder} variant="contained" color="secondary">
                    Build order
                </Button>
            </FormControl>
        </Container>
    );
}