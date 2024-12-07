import ContractManager from './components/ContractManager';
import { Container, Stack } from '@mui/material';
import { ethers } from 'ethers';
import { useState } from 'react';
import DynamicContractItem from './components/DynamicContractItem';
import StaticContractItem from './components/StaticContractItem';
import UniswapX from './components/UniswapX';
import { useConnectWallet } from '@web3-onboard/react';

export interface DynamicContract {
  contract: ethers.BaseContract;
  isStatic: boolean;
}

export default function App(){
    const [contracts, setContracts] = useState<DynamicContract[]>([]);
    const [{wallet}] = useConnectWallet();

    const addContract = (contract: DynamicContract) => {
      setContracts(contracts.concat([contract]));
    };

    const deleteContract = (ind: number) => {
      setContracts(contracts.filter((c, index) => index !== ind));
    };

    return (
      <Container sx={{width: 1}}>
        {
          wallet && (<UniswapX wallet={wallet}/>)
        }
        <ContractManager addContract={addContract}/>
        <Container>
          <Stack spacing={1}>
              {contracts.map((contract, index) => 
                (contract.isStatic ? 
                  <StaticContractItem key={index} contract={contract.contract} del={() => deleteContract(index)}/> :
                  <DynamicContractItem key={index} contract={contract.contract} del={() => deleteContract(index)}/>))}
          </Stack>
        </Container>
      </Container>
    );
}