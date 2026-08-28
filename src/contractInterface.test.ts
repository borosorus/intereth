import { parseContractInterface } from "./contractInterface";

describe("parseContractInterface", () => {
    it("parses JSON ABI input", () => {
        const contractInterface = parseContractInterface(
            JSON.stringify(["function balanceOf(address account) view returns (uint256)"]),
            "json",
        );

        const fragment = contractInterface.getFunction("balanceOf");
        expect(fragment?.inputs[0].name).toBe("account");
    });

    it("parses Solidity function declarations and keeps names", () => {
        const contractInterface = parseContractInterface(
            "function withdraw(address recipient, uint256 amount) external returns (uint256 received);",
            "solidity",
        );

        const fragment = contractInterface.getFunction("withdraw");
        expect(fragment?.inputs.map((input) => input.name)).toEqual(["recipient", "amount"]);
        expect(fragment?.outputs[0].name).toBe("received");
    });

    it("parses multiple Solidity functions", () => {
        const contractInterface = parseContractInterface(
            "function balanceOf(address account) external view returns (uint256); function deposit() external payable;",
            "solidity",
        );

        expect(contractInterface.getFunction("balanceOf")?.stateMutability).toBe("view");
        expect(contractInterface.getFunction("deposit")?.stateMutability).toBe("payable");
    });

    it("rejects Solidity input in JSON mode", () => {
        expect(() => parseContractInterface("function deposit() external payable;", "json")).toThrow();
    });

    it("rejects JSON input in Solidity mode", () => {
        expect(() => parseContractInterface(JSON.stringify(["function deposit() payable"]), "solidity")).toThrow();
    });
});
