export interface ChainConfig {
    id: string;
    token: string;
    label: string;
    rpcUrl: string;
    blockscoutApiUrl?: string;
}

export const chains: ChainConfig[] = [
    {
        id: "1",
        token: "ETH",
        label: "Ethereum Mainnet",
        rpcUrl: "https://ethereum-rpc.publicnode.com",
        blockscoutApiUrl: "https://eth.blockscout.com/api",
    },
    {
        id: "42161",
        token: "ARB-ETH",
        label: "Arbitrum One",
        rpcUrl: "https://arbitrum-one-rpc.publicnode.com",
        blockscoutApiUrl: "https://arbitrum.blockscout.com/api",
    },
    {
        id: "8453",
        token: "ETH",
        label: "Base",
        rpcUrl: "https://base-rpc.publicnode.com",
        blockscoutApiUrl: "https://base.blockscout.com/api",
    },
    {
        id: "10",
        token: "OETH",
        label: "Optimism",
        rpcUrl: "https://optimism-rpc.publicnode.com",
        blockscoutApiUrl: "https://optimism.blockscout.com/api",
    },
];

export const chainsById = new Map(chains.map((chain) => [chain.id, chain]));
