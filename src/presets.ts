export interface AbiPreset {
    id: "erc20" | "erc721" | "erc1155";
    label: string;
    description: string;
    abi: readonly string[];
}

export interface ContractExample {
    id: "weth" | "ens" | "uniswap-v3-factory";
    label: string;
    description: string;
    address: string;
    abi: readonly string[];
    category: "erc20" | "registry" | "defi";
}

export interface ProviderDetails {
    label: string;
    url: string;
    chainId: string;
}

const ERC20_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    "function transfer(address to, uint256 value) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 value) returns (bool)",
    "function transferFrom(address from, address to, uint256 value) returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)",
] as const;

const ERC721_ABI = [
    "function supportsInterface(bytes4 interfaceId) view returns (bool)",
    "function balanceOf(address owner) view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)",
    "function safeTransferFrom(address from, address to, uint256 tokenId)",
    "function transferFrom(address from, address to, uint256 tokenId)",
    "function approve(address to, uint256 tokenId)",
    "function setApprovalForAll(address operator, bool approved)",
    "function getApproved(uint256 tokenId) view returns (address)",
    "function isApprovedForAll(address owner, address operator) view returns (bool)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
    "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
    "event ApprovalForAll(address indexed owner, address indexed operator, bool approved)",
] as const;

const ERC1155_ABI = [
    "function supportsInterface(bytes4 interfaceId) view returns (bool)",
    "function balanceOf(address account, uint256 id) view returns (uint256)",
    "function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])",
    "function setApprovalForAll(address operator, bool approved)",
    "function isApprovedForAll(address account, address operator) view returns (bool)",
    "function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes data)",
    "function safeBatchTransferFrom(address from, address to, uint256[] ids, uint256[] values, bytes data)",
    "function uri(uint256 id) view returns (string)",
    "event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)",
    "event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)",
    "event ApprovalForAll(address indexed account, address indexed operator, bool approved)",
    "event URI(string value, uint256 indexed id)",
] as const;

const WETH_ABI = [
    ...ERC20_ABI,
    "function deposit() payable",
    "function withdraw(uint256 wad)",
    "event Deposit(address indexed dst, uint256 wad)",
    "event Withdrawal(address indexed src, uint256 wad)",
] as const;

const ENS_REGISTRY_ABI = [
    "function supportsInterface(bytes4 interfaceId) view returns (bool)",
    "function owner(bytes32 node) view returns (address)",
    "function resolver(bytes32 node) view returns (address)",
    "function ttl(bytes32 node) view returns (uint64)",
    "function recordExists(bytes32 node) view returns (bool)",
    "function setOwner(bytes32 node, address owner)",
    "function setSubnodeOwner(bytes32 node, bytes32 label, address owner) returns (bytes32)",
    "function setResolver(bytes32 node, address resolver)",
    "function setTTL(bytes32 node, uint64 ttl)",
    "function setApprovalForAll(address operator, bool approved)",
    "function isApprovedForAll(address owner, address operator) view returns (bool)",
    "event Transfer(bytes32 indexed node, address owner)",
    "event NewOwner(bytes32 indexed node, bytes32 indexed label, address owner)",
    "event NewResolver(bytes32 indexed node, address resolver)",
    "event NewTTL(bytes32 indexed node, uint64 ttl)",
] as const;

const UNISWAP_V3_FACTORY_ABI = [
    "function owner() view returns (address)",
    "function feeAmountTickSpacing(uint24 fee) view returns (int24)",
    "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
    "function createPool(address tokenA, address tokenB, uint24 fee) returns (address pool)",
    "function setOwner(address owner)",
    "function enableFeeAmount(uint24 fee, int24 tickSpacing)",
    "event OwnerChanged(address indexed oldOwner, address indexed newOwner)",
    "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)",
    "event FeeAmountEnabled(uint24 indexed fee, int24 indexed tickSpacing)",
] as const;

export const ABI_PRESETS: readonly AbiPreset[] = [
    {id: "erc20", label: "ERC-20", description: "Fungible token and metadata", abi: ERC20_ABI},
    {id: "erc721", label: "ERC-721", description: "NFT core and metadata", abi: ERC721_ABI},
    {id: "erc1155", label: "ERC-1155", description: "Multi-token core and metadata", abi: ERC1155_ABI},
];

export const CONTRACT_EXAMPLES: readonly ContractExample[] = [
    {
        id: "weth",
        label: "Wrapped Ether",
        description: "Inspect Ethereum's canonical wrapped ETH token, including deposit and withdrawal methods.",
        address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        abi: WETH_ABI,
        category: "erc20",
    },
    {
        id: "ens",
        label: "ENS Registry",
        description: "Query the owner, resolver, and TTL records at the root of Ethereum Name Service.",
        address: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
        abi: ENS_REGISTRY_ABI,
        category: "registry",
    },
    {
        id: "uniswap-v3-factory",
        label: "Uniswap V3 Factory",
        description: "Look up pools, fee tiers, and the protocol owner on Uniswap V3.",
        address: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        abi: UNISWAP_V3_FACTORY_ABI,
        category: "defi",
    },
];

export function formatAbi(abi: readonly string[]) {
    return JSON.stringify(abi, null, 2);
}
