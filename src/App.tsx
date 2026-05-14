import ContractManager from './components/ContractManager';
import { Box, Container, Paper, Stack, Typography } from '@mui/material';
import { ethers } from 'ethers';
import { useState } from 'react';
import DynamicContractItem from './components/DynamicContractItem';
import StaticContractItem from './components/StaticContractItem';
import Title from './components/Title';

export interface DynamicContract {
  id: string;
  contract: ethers.BaseContract;
  isStatic: boolean;
}

export default function App(){
    const [contracts, setContracts] = useState<DynamicContract[]>([]);

    const addContract = (contract: DynamicContract) => {
      setContracts((current) => current.concat([contract]));
    };

    const deleteContract = (id: string) => {
      setContracts((current) => current.filter((contract) => contract.id !== id));
    };

    return (
      <Box sx={{px: {xs: 2, sm: 3}, pb: 6}}>
        <Container maxWidth="lg" sx={{py: {xs: 3, md: 4}}}>
          <Stack spacing={3}>
            <Title />
            <Paper
              elevation={0}
              sx={{
                p: {xs: 2, md: 3},
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'rgba(255,255,255,0.78)',
                backdropFilter: 'blur(18px)',
              }}
            >
              <ContractManager addContract={addContract}/>
            </Paper>
            <Box>
              {contracts.length === 0 ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: {xs: 3, md: 4},
                    textAlign: 'center',
                    borderRadius: 3,
                    border: '1px dashed',
                    borderColor: 'divider',
                    color: 'text.secondary',
                    backgroundColor: 'rgba(255,255,255,0.55)',
                  }}
                >
                  <Typography variant="h6" gutterBottom>
                    No contract instances yet
                  </Typography>
                  <Typography variant="body2">
                    Add an address, ABI, and provider above to start interacting.
                  </Typography>
                </Paper>
              ) : (
                <Stack spacing={2}>
                  {contracts.map((contract) => 
                    (contract.isStatic ? 
                      <StaticContractItem key={contract.id} contract={contract.contract} del={() => deleteContract(contract.id)}/> :
                      <DynamicContractItem key={contract.id} contract={contract.contract} del={() => deleteContract(contract.id)}/>))}
                </Stack>
              )}
            </Box>
          </Stack>
        </Container>
      </Box>
    );
}
