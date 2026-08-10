export const chains = [
    {
        id: "1",
        token: "ETH",
        label: "Ethereum Mainnet",
        rpcUrl: "https://ethereum-rpc.publicnode.com",
    },
    {
        id: "42161",
        token: "ARB-ETH",
        label: "Arbitrum One",
        rpcUrl: "https://arbitrum-one-rpc.publicnode.com",
    },
    {
        id: "8453",
        token: "ETH",
        label: "Base",
        rpcUrl: "https://base-rpc.publicnode.com",
    },
    {
        id: "10",
        token: "OETH",
        label: "Optimism",
        rpcUrl: "https://optimism-rpc.publicnode.com",
    },
];

export const chainsById = new Map(chains.map((chain) => [chain.id, chain]));
