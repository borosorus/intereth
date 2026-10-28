import ContractManager from './components/ContractManager';
import { Alert, Box, Button, Container, DialogActions, DialogContent, DialogTitle, Paper, Snackbar, Stack, useMediaQuery } from '@mui/material';
import { useState } from 'react';
import DynamicContractItem from './components/DynamicContractItem';
import StaticContractItem from './components/StaticContractItem';
import ExecutionWorkspace from './components/execution/ExecutionWorkspace';
import ExecutionTray from './components/ExecutionTray';
import ContractNavigation from './components/ContractNavigation';
import ResponsiveDialog from './components/ResponsiveDialog';
import { ContractInstance, useContractWorkspace } from './contracts/workspace';
import { useTransactionPlan } from './transaction-plan/context';
import { useTransactionPlanUi } from './transaction-plan/uiContext';
import { workspaceSurfaceSx } from './ui/styles';

export default function App(){
    const workspace = useContractWorkspace();
    const {activeView} = useTransactionPlanUi();
    const {state} = useTransactionPlan();
    const isWideViewport = useMediaQuery('(min-width:1280px)');
    const [addContractOpen, setAddContractOpen] = useState(false);
    const [managerGeneration, setManagerGeneration] = useState(0);
    const [trayHeight, setTrayHeight] = useState(0);
    const {contracts, selectedContract} = workspace;
    const trayVisible = state.plan.calls.length > 0 || state.plan.watches.length > 0;
    const wideExplore = activeView === "explore" && trayVisible && isWideViewport;
    const reserveMobileTraySpace = activeView === "explore" && trayVisible && !isWideViewport;

    const addFromDialog = (contract: ContractInstance) => {
      workspace.addContract(contract);
      setAddContractOpen(false);
      setManagerGeneration((current) => current + 1);
    };

    // Both views stay mounted so execution status polling and in-flight
    // submission state survive view switches; the inactive view is hidden.
    return (
      <Box sx={{pb: reserveMobileTraySpace ? `${trayHeight + 24}px` : 6}}>
        <Container maxWidth="lg" sx={{py: {xs: 3, md: 4}}}>
          <Box sx={{display: activeView === "explore" ? "block" : "none"}}>
            <Stack spacing={3} sx={{minWidth: 0}}>
                {contracts.length === 0 && <ContractManager addContract={workspace.addContract} showExamples />}
                {selectedContract && (
                  <Paper component="section" variant="outlined" sx={{...workspaceSurfaceSx, p: {xs: 1.25, sm: 2}, background: "linear-gradient(140deg, rgba(99, 102, 241, 0.045), #fff 34%)"}}>
                    <Box sx={{display: "grid", gridTemplateColumns: {xs: "minmax(0, 1fr)", md: "250px minmax(0, 1fr)"}, gap: 2, alignItems: "start"}}>
                      <ContractNavigation
                        contracts={contracts}
                        selectedId={selectedContract.id}
                        onSelect={workspace.selectContract}
                        onDelete={workspace.removeContract}
                        onAdd={() => setAddContractOpen(true)}
                      />
                      <Stack spacing={2} sx={{minWidth: 0}}>
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
                  </Paper>
                )}
            </Stack>
            {trayVisible && (
              <Box
                component="aside"
                aria-label="Execution plan"
                sx={{
                  position: "fixed",
                  zIndex: 1090,
                  right: "12px",
                  bottom: "calc(12px + env(safe-area-inset-bottom))",
                  width: "min(340px, calc(100vw - 24px))",
                  maxHeight: "min(42dvh, 340px)",
                  overflowY: "auto",
                  "@media (min-width:1280px)": {
                    right: 24,
                    bottom: 24,
                    width: 288,
                    maxHeight: "calc(100dvh - 96px)",
                  },
                }}
              >
                <ExecutionTray onHeightChange={setTrayHeight} />
              </Box>
            )}
          </Box>
          <Box sx={{display: activeView === "execution" ? "block" : "none"}}>
            <Paper component="section" variant="outlined" sx={{...workspaceSurfaceSx, p: {xs: 1.25, sm: 2}, background: "linear-gradient(140deg, rgba(2, 132, 199, 0.04), #fff 40%)"}}>
              <ExecutionWorkspace active={activeView === "execution"} />
            </Paper>
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
          anchorOrigin={{vertical: "bottom", horizontal: wideExplore ? "left" : "center"}}
          sx={reserveMobileTraySpace ? {bottom: trayHeight + 24} : undefined}
        >
          <Alert severity="info" variant="filled" onClose={workspace.dismissNotice}>{workspace.notice}</Alert>
        </Snackbar>
      </Box>
    );
}
