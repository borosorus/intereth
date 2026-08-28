import { ethers } from "ethers";

export type ContractInterfaceFormat = "json" | "solidity";

function normalizeSolidityFunction(declaration: string) {
    const fragment = declaration.trim().replace(/;+\s*$/, "");
    if (!fragment.startsWith("function ")) {
        throw new Error("Solidity interface entries must be function declarations.");
    }

    const paramsStart = fragment.indexOf("(");
    if (paramsStart < 0) {
        throw new Error("Invalid Solidity function declaration.");
    }

    let depth = 0;
    let paramsEnd = -1;
    for (let index = paramsStart; index < fragment.length; index += 1) {
        if (fragment[index] === "(") depth += 1;
        if (fragment[index] === ")") {
            depth -= 1;
            if (depth === 0) {
                paramsEnd = index;
                break;
            }
        }
    }

    if (paramsEnd < 0) {
        throw new Error("Invalid Solidity function declaration.");
    }

    const head = fragment.slice(0, paramsEnd + 1);
    const tail = fragment.slice(paramsEnd + 1);
    const returnsIndex = tail.search(/\breturns\b/);
    const modifiers = returnsIndex >= 0 ? tail.slice(0, returnsIndex) : tail;
    const returnsClause = returnsIndex >= 0 ? tail.slice(returnsIndex) : "";

    if (/\b(private|internal)\b/.test(modifiers)) {
        throw new Error("Private or internal functions cannot be called through a contract interface.");
    }

    const normalizedModifiers = modifiers
        .replace(/\b(external|public)\b/g, "")
        .replace(/\s+/g, " ")
        .trim();

    return [head, normalizedModifiers, returnsClause.trim()].filter(Boolean).join(" ");
}

export function parseContractInterface(input: string, format: ContractInterfaceFormat) {
    if (format === "json") {
        const parsed = JSON.parse(input);
        if (!Array.isArray(parsed)) {
            throw new Error("JSON ABI must be an array.");
        }
        return new ethers.Interface(parsed);
    }

    const declarations = input
        .split(";")
        .map((entry) => entry.trim())
        .filter(Boolean);

    if (declarations.length === 0) {
        throw new Error("Enter at least one Solidity function declaration.");
    }

    const fragments = declarations.map((declaration) =>
        ethers.FunctionFragment.from(normalizeSolidityFunction(declaration)),
    );
    return new ethers.Interface(fragments);
}
