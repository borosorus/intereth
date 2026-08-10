import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ethers } from "ethers";
import { useSimulation } from "../simulation/context";
import { StaticFunctionItem } from "./StaticContractItem";
import { useWorkspaceMode } from "../workspace/context";

jest.mock("../simulation/context", () => ({useSimulation: jest.fn()}));
jest.mock("../wallet/WalletSessionContext", () => ({useWalletSession: jest.fn()}));
jest.mock("../transaction-plan/context", () => ({useTransactionPlan: jest.fn()}));
jest.mock("../workspace/context", () => ({useWorkspaceMode: jest.fn()}));

const mockedSimulation = useSimulation as jest.MockedFunction<typeof useSimulation>;
const mockedWorkspace = useWorkspaceMode as jest.MockedFunction<typeof useWorkspaceMode>;

describe("StaticFunctionItem simulated reads", () => {
    beforeEach(() => mockedWorkspace.mockReturnValue({mode: "simulate", setMode: jest.fn()}));
    it("uses queued-state simulation as the primary action", async () => {
        const simulateRead = jest.fn().mockResolvedValue({
            returnData: ethers.AbiCoder.defaultAbiCoder().encode(["bool"], [true]),
            gasUsed: "0x30",
        });
        mockedSimulation.mockReturnValue({
            active: true,
            status: "ready",
            chainId: "1",
            error: null,
            snapshot: null,
            revision: "ready:1",
            queuedCallCount: 3,
            configured: true,
            retry: jest.fn(),
            canSimulateChain: jest.fn().mockReturnValue(true),
            simulateRead,
        });
        const fragment = new ethers.Interface(["function active() view returns (bool)"]).getFunction("active")!;
        const onChainCall = jest.fn();
        const contract = {
            runner: {call: onChainCall},
            getAddress: jest.fn().mockResolvedValue("0x0000000000000000000000000000000000000010"),
            getFunction: jest.fn(),
        } as unknown as ethers.BaseContract;

        render(<StaticFunctionItem contract={contract} frag={fragment} chainId="1" />);
        fireEvent.click(screen.getByRole("button", {name: /active function active/}));
        fireEvent.click(screen.getByRole("button", {name: "Run simulated"}));

        await waitFor(() => expect(simulateRead).toHaveBeenCalledWith("1", {
            to: "0x0000000000000000000000000000000000000010",
            data: fragment.selector,
        }));
        expect(await screen.findByText("true")).toBeInTheDocument();
        expect(screen.getByText(/after 3 queued calls/)).toBeInTheDocument();
        expect(onChainCall).not.toHaveBeenCalled();
    });

    it("keeps an explicit ordinary on-chain action", async () => {
        const simulateRead = jest.fn();
        mockedSimulation.mockReturnValue({
            active: true,
            status: "ready",
            chainId: "1",
            error: null,
            snapshot: null,
            revision: "ready:1",
            queuedCallCount: 1,
            configured: true,
            retry: jest.fn(),
            canSimulateChain: jest.fn().mockReturnValue(true),
            simulateRead,
        });
        const fragment = new ethers.Interface(["function active() view returns (bool)"]).getFunction("active")!;
        const onChainRead = jest.fn().mockResolvedValue(false);
        const contract = {
            runner: {call: jest.fn()},
            getFunction: jest.fn().mockReturnValue(onChainRead),
        } as unknown as ethers.BaseContract;

        render(<StaticFunctionItem contract={contract} frag={fragment} chainId="1" />);
        fireEvent.click(screen.getByRole("button", {name: /active function active/}));
        fireEvent.click(screen.getByRole("button", {name: "Run on-chain"}));

        await waitFor(() => expect(onChainRead).toHaveBeenCalledWith());
        expect(await screen.findByText("false")).toBeInTheDocument();
        expect(screen.getByText("On-chain")).toBeInTheDocument();
        expect(simulateRead).not.toHaveBeenCalled();
    });
});
