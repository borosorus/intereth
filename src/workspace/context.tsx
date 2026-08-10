import { createContext, ReactNode, useContext, useMemo, useState } from "react";

export type WorkspaceMode = "interact" | "simulate";

interface WorkspaceModeContextValue {
    mode: WorkspaceMode;
    setMode: (mode: WorkspaceMode) => void;
}

const WorkspaceModeContext = createContext<WorkspaceModeContextValue | null>(null);

export function WorkspaceModeProvider({children}: {children: ReactNode}) {
    const [mode, setMode] = useState<WorkspaceMode>("interact");
    const value = useMemo(() => ({mode, setMode}), [mode]);

    return <WorkspaceModeContext.Provider value={value}>{children}</WorkspaceModeContext.Provider>;
}

export function useWorkspaceMode() {
    const context = useContext(WorkspaceModeContext);
    if (!context) {
        throw new Error("useWorkspaceMode must be used inside WorkspaceModeProvider");
    }
    return context;
}
