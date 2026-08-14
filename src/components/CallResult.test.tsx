import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ethers } from "ethers";
import CallResult from "./CallResult";

describe("CallResult", () => {
    it("renders typed output rows", () => {
        const outputs = new ethers.Interface(["function read() view returns (uint256 total, bool active)"]).getFunction("read")!.outputs;
        render(<CallResult result={{kind: "function", outputs, value: [BigInt(12), true], source: {kind: "onchain"}}} />);

        expect(screen.getByText("Call result")).toBeInTheDocument();
        expect(screen.getByText("total")).toBeInTheDocument();
        expect(screen.getByText("uint256")).toBeInTheDocument();
        expect(screen.getByText("12")).toBeInTheDocument();
        expect(screen.getByText("true")).toBeInTheDocument();
    });

    it("makes zero-output completion explicit", () => {
        render(<CallResult result={{kind: "function", outputs: [], value: undefined, source: {kind: "onchain"}}} />);
        expect(screen.getByText("Call completed with no return value.")).toBeInTheDocument();
    });

    it("labels speculative results with their queue context", () => {
        render(<CallResult result={{kind: "raw", data: "0x1234", source: {kind: "simulated", queuedCallCount: 2}}} />);
        expect(screen.getByText("Speculative")).toBeInTheDocument();
        expect(screen.getByText(/after 2 queued calls/)).toBeInTheDocument();
    });
});
