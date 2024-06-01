import ContractManager from './components/ContractManager';
import { Container, Stack } from '@mui/material';
import { ethers } from 'ethers';
import { useEffect, useState } from 'react';
import ContractItem from './components/ContractItem';

export interface DynamicContract {
  contract: ethers.BaseContract;
  isStatic: boolean;
}

export default function App(){
    const [contracts, setContracts] = useState<DynamicContract[]>([]);

    const addContract = (contract: DynamicContract) => {
      setContracts(contracts.concat([contract]));
    };

    useEffect(() => console.log(contracts), [contracts]);

    const deleteContract = (ind: number) => {
      setContracts(contracts.filter((c, index) => index !== ind));
    };

    return (
      <Container sx={{width: 1}}>
        <ContractManager addContract={addContract}/>
        <Container>
          <Stack spacing={2}>
              {contracts.map((contract, index) => (<ContractItem key={index} contract={contract} del={() => deleteContract(index)}/>))}
          </Stack>
        </Container>
      </Container>
    );
}