import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ReadActions from "./ReadActions";

describe("ReadActions capabilities", () => {
    it("offers canonical and speculative calls when queued-state simulation is available", () => {
        const onPinWatch = vi.fn();
        render(
            <ReadActions
                simulationAvailable
                onChainAvailable
                loading={null}
                onSimulated={vi.fn()}
                onOnChain={vi.fn()}
                onPinWatch={onPinWatch}
                canPinWatch
            />,
        );

        expect(screen.getByRole("button", {name: "Run speculative"})).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Run on-chain"})).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Pin watch"}));
        expect(onPinWatch).toHaveBeenCalled();
    });

    it("offers only the canonical call when simulation is unavailable", () => {
        const onChain = vi.fn();
        render(
            <ReadActions
                simulationAvailable={false}
                onChainAvailable
                loading={null}
                onSimulated={vi.fn()}
                onOnChain={onChain}
                onPinWatch={vi.fn()}
                canPinWatch
            />,
        );

        expect(screen.queryByRole("button", {name: "Run speculative"})).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Run on-chain"}));
        expect(onChain).toHaveBeenCalled();
    });

    it("disables actions while a read is in flight", () => {
        render(
            <ReadActions
                simulationAvailable
                onChainAvailable
                loading="simulated"
                onSimulated={vi.fn()}
                onOnChain={vi.fn()}
                onPinWatch={vi.fn()}
                canPinWatch
            />,
        );

        expect(screen.getByRole("button", {name: "Run on-chain"})).toBeDisabled();
        expect(screen.getByRole("button", {name: /Pin watch/})).toBeDisabled();
    });

    it("gates pinning on the plan-edit capability", () => {
        render(
            <ReadActions
                simulationAvailable={false}
                onChainAvailable
                loading={null}
                onSimulated={vi.fn()}
                onOnChain={vi.fn()}
                onPinWatch={vi.fn()}
                canPinWatch={false}
            />,
        );

        expect(screen.getByRole("button", {name: /Pin watch/})).toBeDisabled();
    });
});
