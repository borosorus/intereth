import ContractManager from './components/ContractManager';
import { Alert, Box, Container, Paper, Snackbar, Stack } from '@mui/material';
import { ethers } from 'ethers';
import { useLayoutEffect, useRef, useState } from 'react';
import DynamicContractItem from './components/DynamicContractItem';
import StaticContractItem from './components/StaticContractItem';
import { ProviderDetails } from './presets';
import TransactionQueuePanel from './components/transaction-plan/TransactionQueuePanel';
import { useWalletSession } from './wallet/WalletSessionContext';
import { useTransactionPlan } from './transaction-plan/context';
import { reconcileWalletWorkspace, WalletIdentity } from './wallet/workspaceLifecycle';
import WatchPanel from './components/simulation/WatchPanel';

interface ContractInstanceBase {
  id: string;
  contract: ethers.BaseContract;
}

export type DynamicContract = ContractInstanceBase & (
  | {isStatic: true; providerDetails?: ProviderDetails}
  | {isStatic: false; walletChainId: string}
);

export default function App(){
    const [contracts, setContracts] = useState<DynamicContract[]>([]);
    const [interactionAccount, setInteractionAccount] = useState<string | null>(null);
    const [workspaceNotice, setWorkspaceNotice] = useState<string | null>(null);
    const wallet = useWalletSession();
    const transactionPlan = useTransactionPlan();
    const contractsRef = useRef(contracts);
    const planStateRef = useRef(transactionPlan.state);
    const previousIdentity = useRef<WalletIdentity | null>(null);
    contractsRef.current = contracts;
    planStateRef.current = transactionPlan.state;

    useLayoutEffect(() => {
      if (!wallet.account || !wallet.chainId) {
        return;
      }

      const nextIdentity = {account: wallet.account, chainId: wallet.chainId};
      const previous = previousIdentity.current;
      const transition = reconcileWalletWorkspace(contractsRef.current, planStateRef.current, previous, nextIdentity);

      if (transition.removedCount > 0) {
        setContracts(transition.remainingContracts);
      }
      if (!interactionAccount || transition.accountChanged) {
        setInteractionAccount(nextIdentity.account);
      }
      if (transition.notice) {
        setWorkspaceNotice(transition.notice);
      }

      previousIdentity.current = nextIdentity;
    }, [interactionAccount, wallet.account, wallet.chainId]);

    const addContract = (contract: DynamicContract) => {
      setContracts((current) => current.concat([contract]));
    };

    const deleteContract = (id: string) => {
      const instance = contracts.find((contract) => contract.id === id);
      if (instance?.isStatic) {
        const provider = instance.contract.runner?.provider;
        if (provider instanceof ethers.JsonRpcProvider) {
          provider.destroy();
        }
      }
      setContracts((current) => current.filter((contract) => contract.id !== id));
    };

    return (
      <Box sx={{px: {xs: 2, sm: 3}, pb: 6}}>
        <Container maxWidth="lg" sx={{py: {xs: 3, md: 4}}}>
          <Stack spacing={3}>
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
              <ContractManager addContract={addContract} showExamples={contracts.length === 0}/>
            </Paper>
            <WatchPanel />
            {contracts.length > 0 && (
              <Box>
                <Stack spacing={2}>
                  {contracts.map((contract) => 
                    (contract.isStatic ? 
                      <StaticContractItem key={contract.id} contract={contract.contract} providerDetails={contract.providerDetails} del={() => deleteContract(contract.id)}/> :
                      <DynamicContractItem
                        key={`${contract.id}:${interactionAccount ?? "disconnected"}`}
                        contract={contract.contract}
                        walletChainId={contract.walletChainId}
                        del={() => deleteContract(contract.id)}
                      />))}
                </Stack>
              </Box>
            )}
          </Stack>
        </Container>
        <TransactionQueuePanel />
        <Snackbar
          open={Boolean(workspaceNotice)}
          autoHideDuration={7000}
          onClose={(_, reason) => {
            if (reason !== "clickaway") setWorkspaceNotice(null);
          }}
          anchorOrigin={{vertical: "bottom", horizontal: "center"}}
        >
          <Alert severity="info" variant="filled" onClose={() => setWorkspaceNotice(null)}>{workspaceNotice}</Alert>
        </Snackbar>
      </Box>
    );
}
