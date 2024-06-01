import { styled } from '@mui/material/styles';
import ContractManager from './components/ContractManager';
import { Container, Paper, Stack } from '@mui/material';
import { ethers } from 'ethers';
import { useMemo, useState } from 'react';
import ContractItem from './components/ContractItem';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));

export default function App(){
    const [contracts, setContracts] = useState<ethers.Contract[]>([]);

    const addContract = useMemo(() => (contract: ethers.Contract) => {
      setContracts(contracts.concat([contract]));
    }, [contracts]);

    const deleteContract = useMemo(() => (id: number) => {
      setContracts(contracts.splice(id));
    }, [contracts]);
    return (
      <Container sx={{width: 1}}>
        <ContractManager addContract={addContract}/>
        <Container>
          <Stack spacing={2}>
              {contracts.map((contract) => (<ContractItem contract={contract}/>))}
          </Stack>
        </Container>
      </Container>
    );
}