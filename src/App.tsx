import ContractManager from './components/ContractManager';
import { Alert, Box, Button, Container, DialogActions, DialogContent, DialogTitle, Paper, Snackbar, Stack } from '@mui/material';
import { useState } from 'react';
import DynamicContractItem from './components/DynamicContractItem';
import StaticContractItem from './components/StaticContractItem';
import ExecutionWorkspace from './components/execution/ExecutionWorkspace';
import ContractNavigation from './components/ContractNavigation';
import ResponsiveDialog from './components/ResponsiveDialog';
import WorkspaceEmptyGuidance from './components/WorkspaceEmptyGuidance';
import { ContractInstance, useContractWorkspace } from './contracts/workspace';
import { useTransactionPlanUi } from './transaction-plan/uiContext';

export default function App(){
    const workspace = useContractWorkspace();
    const {activeView} = useTransactionPlanUi();
    const [addContractOpen, setAddContractOpen] = useState(false);
    const [managerGeneration, setManagerGeneration] = useState(0);
    const {contracts, selectedContract} = workspace;

    const addFromDialog = (contract: ContractInstance) => {
      workspace.addContract(contract);
      setAddContractOpen(false);
      setManagerGeneration((current) => current + 1);
    };

    // Both views stay mounted so execution status polling and in-flight
    // submission state survive view switches; the inactive view is hidden.
    return (
      <Box sx={{pb: 6}}>
        <Container maxWidth="lg" sx={{py: {xs: 3, md: 4}}}>
          <Box sx={{display: activeView === "explore" ? "block" : "none"}}>
            <Stack spacing={3}>
              {contracts.length === 0 && <Paper
                variant="outlined"
                sx={{
                  p: {xs: 2, md: 3},
                  borderRadius: 2.5,
                }}
              >
                <ContractManager addContract={workspace.addContract} showExamples={contracts.length === 0}/>
              </Paper>}
              {selectedContract && (
                <Box sx={{display: "grid", gridTemplateColumns: {xs: "minmax(0, 1fr)", md: "250px minmax(0, 1fr)"}, gap: 2, alignItems: "start"}}>
                  <ContractNavigation
                    contracts={contracts}
                    selectedId={selectedContract.id}
                    onSelect={workspace.selectContract}
                    onRename={workspace.renameContract}
                    onDelete={workspace.removeContract}
                    onAdd={() => setAddContractOpen(true)}
                  />
                  <Stack spacing={2} sx={{minWidth: 0}}>
                    <WorkspaceEmptyGuidance />
                    {selectedContract.isStatic ?
                        <StaticContractItem key={selectedContract.id} contractId={selectedContract.id} contract={selectedContract.contract} providerDetails={selectedContract.providerDetails}/> :
                        <DynamicContractItem
                          key={`${selectedContract.id}:${workspace.interactionAccount ?? "disconnected"}`}
                          contractId={selectedContract.id}
                          contract={selectedContract.contract}
                          walletChainId={selectedContract.walletChainId}
                        />}
                  </Stack>
                </Box>
              )}
            </Stack>
          </Box>
          <Box sx={{display: activeView === "execution" ? "block" : "none"}}>
            <ExecutionWorkspace active={activeView === "execution"} />
          </Box>
        </Container>
        <ResponsiveDialog open={addContractOpen} onClose={() => setAddContractOpen(false)} maxWidth="md">
          <DialogTitle>Add contract</DialogTitle>
          <DialogContent dividers sx={{pt: 2}}>
            <ContractManager key={managerGeneration} addContract={addFromDialog} showExamples={false} />
          </DialogContent>
          <DialogActions><Button onClick={() => setAddContractOpen(false)}>Cancel</Button></DialogActions>
        </ResponsiveDialog>
        <Snackbar
          open={Boolean(workspace.notice)}
          autoHideDuration={7000}
          onClose={(_, reason) => {
            if (reason !== "clickaway") workspace.dismissNotice();
          }}
          anchorOrigin={{vertical: "bottom", horizontal: "center"}}
        >
          <Alert severity="info" variant="filled" onClose={workspace.dismissNotice}>{workspace.notice}</Alert>
        </Snackbar>
      </Box>
    );
}
