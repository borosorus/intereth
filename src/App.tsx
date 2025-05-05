import ContractManager from './components/ContractManager';
import { Container, Stack, Typography } from '@mui/material';
import { ethers } from 'ethers';
import { useState } from 'react';
import DynamicContractItem from './components/DynamicContractItem';
import StaticContractItem from './components/StaticContractItem';
import { useConnectWallet } from '@web3-onboard/react';
import Title from './components/Title';

export interface DynamicContract {
  contract: ethers.BaseContract;
  isStatic: boolean;
}

export default function App(){
    const [contracts, setContracts] = useState<DynamicContract[]>([]);

    const addContract = (contract: DynamicContract) => {
      setContracts(contracts.concat([contract]));
    };

    const deleteContract = (ind: number) => {
      setContracts(contracts.filter((c, index) => index !== ind));
    };

    return (
      <Container sx={{width: 1}}>
        <Title />
        <ContractManager addContract={addContract}/>
        <Container>
          <Stack spacing={1} sx={{py: 2}}>
              {contracts.map((contract, index) => 
                (contract.isStatic ? 
                  <StaticContractItem key={index} contract={contract.contract} del={() => deleteContract(index)}/> :
                  <DynamicContractItem key={index} contract={contract.contract} del={() => deleteContract(index)}/>))}
          </Stack>
        </Container>
      </Container>
    );
}