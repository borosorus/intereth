import ContractManager from './components/ContractManager';
import { Container, Stack } from '@mui/material';
import { ethers } from 'ethers';
import { useMemo, useState } from 'react';
import ContractItem from './components/ContractItem';

export default function App(){
    const [contracts, setContracts] = useState<ethers.BaseContract[]>([]);

    const addContract = useMemo(() => (contract: ethers.BaseContract) => {
      setContracts(contracts.concat([contract]));
    }, [contracts]);

    /*const deleteContract = useMemo(() => (id: number) => {
      setContracts(contracts.splice(id));
    }, [contracts]);*/

    return (
      <Container sx={{width: 1}}>
        <ContractManager addContract={addContract}/>
        <Container>
          <Stack spacing={2}>
              {contracts.map((contract) => (<ContractItem key={Math.floor((Math.random() * 929219) + 1)} contract={contract}/>))}
          </Stack>
        </Container>
      </Container>
    );
}