import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SafeAccountInfo, useWalletSession, WalletSession } from "../wallet/WalletSessionContext";
import { useTransactionPlan } from "../transaction-plan/context";
import ConnectionButton from "./ConnectionButton";

vi.mock("../wallet/WalletSessionContext", () => ({useWalletSession: vi.fn()}));
vi.mock("../transaction-plan/context", () => ({useTransactionPlan: vi.fn()}));

const OWNER = "0x0000000000000000000000000000000000000001";
const SAFE = "0x00000000000000000000000000000000000000aa";

const selectedSafe: SafeAccountInfo = {
    address: SAFE,
    chainId: "1",
    owners: [OWNER],
    threshold: 1,
    nonce: 4,
    version: "1.4.1",
    source: "manual",
};

function walletSession(overrides: Partial<WalletSession> = {}): WalletSession {
    return {
        status: "ready",
        provider: null,
        signer: null,
        account: OWNER,
        chainId: "1",
        safeAccount: null,
        savedSafes: [],
        error: null,
        clearError: vi.fn(),
        connectWallet: vi.fn(),
        switchChain: vi.fn(),
        selectSafe: vi.fn(),
        ...overrides,
    };
}

function renderButton(overrides: Partial<WalletSession> = {}) {
    const session = walletSession(overrides);
    vi.mocked(useWalletSession).mockReturnValue(session);
    vi.mocked(useTransactionPlan).mockReturnValue({
        state: {plan: {context: null}, sequentialExecution: {status: "idle", calls: []}},
    } as never);
    render(<ConnectionButton />);
    fireEvent.click(screen.getByRole("button", {name: "Manage Safe accounts"}));
    return session;
}

function fillAddress() {
    fireEvent.change(screen.getByLabelText("Add a Safe address"), {target: {value: SAFE}});
}

describe("ConnectionButton Safe address flow", () => {
    it("shows progress, then a success card and a cleared form", async () => {
        let resolveSelection: (info: SafeAccountInfo) => void = () => undefined;
        const selectSafe = vi.fn(() => new Promise<SafeAccountInfo>((resolve) => {
            resolveSelection = resolve;
        }));
        renderButton({selectSafe});
        fillAddress();

        fireEvent.click(screen.getByRole("button", {name: "Verify and add Safe"}));
        expect(await screen.findByRole("progressbar")).toBeInTheDocument();
        expect(selectSafe).toHaveBeenCalledWith(SAFE);

        await act(async () => {
            resolveSelection(selectedSafe);
        });

        const success = await screen.findByRole("alert", {name: "Safe added"});
        expect(success).toHaveTextContent(`Safe ${SAFE} verified on Ethereum Mainnet and set as active.`);
        expect(success).toHaveTextContent("1 owner · threshold 1 · saved to your address book");
        expect(screen.queryByLabelText("Add a Safe address")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Done"}));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("offers another address after success", async () => {
        renderButton({selectSafe: vi.fn().mockResolvedValue(selectedSafe)});
        fillAddress();
        fireEvent.click(screen.getByRole("button", {name: "Verify and add Safe"}));
        await screen.findByRole("alert", {name: "Safe added"});

        fireEvent.click(screen.getByRole("button", {name: "Add another Safe"}));
        expect(screen.getByLabelText("Add a Safe address")).toHaveValue("");
        expect(screen.queryByRole("alert", {name: "Safe added"})).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", {name: "Close"}));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("reports an already saved Safe without duplicating it", async () => {
        renderButton({
            selectSafe: vi.fn().mockResolvedValue(selectedSafe),
            savedSafes: [{address: SAFE, chainId: "1"}],
        });
        fillAddress();
        fireEvent.click(screen.getByRole("button", {name: "Verify and add Safe"}));

        const success = await screen.findByRole("alert", {name: "Safe added"});
        expect(success).toHaveTextContent("already in your address book");
    });

    it("shows verification failures inline instead of stacking a dialog", async () => {
        const selectSafe = vi.fn().mockRejectedValue(Object.assign(
            new Error("The connected wallet is not an owner of this Safe."),
            {code: "SAFE_OWNER_REQUIRED"},
        ));
        renderButton({selectSafe});
        fillAddress();
        fireEvent.click(screen.getByRole("button", {name: "Verify and add Safe"}));

        expect(await screen.findByText("The connected wallet is not an owner of this Safe.")).toBeInTheDocument();
        expect(screen.getByRole("dialog", {name: "Safe accounts"})).toBeInTheDocument();
        expect(screen.getByLabelText("Add a Safe address")).toHaveValue(SAFE);
        expect(screen.queryByText("Safe verification failed")).not.toBeInTheDocument();
    });
});
