import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ethers } from "ethers";
import CallResult from "./CallResult";

describe("CallResult", () => {
    it("renders typed output rows", () => {
        const outputs = new ethers.Interface(["function read() view returns (uint256 total, bool active)"]).getFunction("read")!.outputs;
        render(<CallResult result={{kind: "function", outputs, value: [BigInt(12), true]}} />);

        expect(screen.getByText("Call result")).toBeInTheDocument();
        expect(screen.getByText("total")).toBeInTheDocument();
        expect(screen.getByText("uint256")).toBeInTheDocument();
        expect(screen.getByText("12")).toBeInTheDocument();
        expect(screen.getByText("true")).toBeInTheDocument();
    });

    it("makes zero-output completion explicit", () => {
        render(<CallResult result={{kind: "function", outputs: [], value: undefined}} />);
        expect(screen.getByText("Call completed with no return value.")).toBeInTheDocument();
    });
});
