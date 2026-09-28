import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type WorkspaceView = "explore" | "execution";

interface WorkspaceUi {
    activeView: WorkspaceView;
    setActiveView: (view: WorkspaceView) => void;
    requestExecution: () => void;
}

function viewFromHash(): WorkspaceView {
    if (typeof window === "undefined") return "explore";
    return window.location.hash.replace(/^#\/?/, "") === "execution" ? "execution" : "explore";
}

const WorkspaceUiContext = createContext<WorkspaceUi>({
    activeView: "explore",
    setActiveView: () => undefined,
    requestExecution: () => undefined,
});

// The active workspace view is addressable via the URL hash ("#/execution") so
// back/forward and refresh keep the user where they were. A hash routing
// library is unnecessary for two views and keeps the GitHub Pages deploy
// constraints simple.
export function TransactionPlanUiProvider({children}: {children: ReactNode}) {
    const [activeView, setViewState] = useState<WorkspaceView>(viewFromHash);

    useEffect(() => {
        const onHashChange = () => setViewState(viewFromHash());
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    const setActiveView = useCallback((view: WorkspaceView) => {
        setViewState(view);
        const target = `#/${view}`;
        if (window.location.hash !== target) {
            window.history.pushState(null, "", target);
        }
    }, []);

    const requestExecution = useCallback(() => setActiveView("execution"), [setActiveView]);

    const value = useMemo(() => ({activeView, setActiveView, requestExecution}), [activeView, requestExecution, setActiveView]);
    return <WorkspaceUiContext.Provider value={value}>{children}</WorkspaceUiContext.Provider>;
}

export function useTransactionPlanUi() {
    return useContext(WorkspaceUiContext);
}
