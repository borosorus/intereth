# Intereth

Intereth is a browser-based interface for inspecting and calling EVM smart contracts. Provide a contract address, ABI, and RPC endpoint for read-only access, or connect a browser wallet to send transactions.

Live app: [borosorus.github.io/intereth](https://borosorus.github.io/intereth)

## Features

- Works with predefined networks or any custom HTTP RPC endpoint.
- Includes Ethereum examples for WETH, ENS Registry, and Uniswap V3 Factory.
- Provides editable ERC-20, ERC-721, and ERC-1155 ABI presets.
- Can fetch verified contract ABIs from Sourcify and Blockscout without an API key.
- Supports nested tuples, arrays, raw calldata, payable calls, and transaction values.
- Formats unsigned integer inputs as wei, gwei, or ETH while previewing the final integer value.
- Shows the active RPC URL and chain ID on read-only contract instances.
- Builds an ordered, browser-persisted execution plan without opening the wallet.
- Sends compatible plans as atomic wallet batches through EIP-5792.
- Offers speculative reads, watches, and plan previews as explicit actions driven by current capabilities.
- Decodes simulated events, reverts, return data, and supported ERC-20/native balance changes.

## Usage

Intereth has two workspace views, switched from the header (also addressable as `#/explore` and `#/execution`):

- **Explore** — open contracts, inspect identity and network, search functions, edit arguments or raw calldata, run reads, send single transactions immediately, or add calls to the execution plan.
- **Execution** — review the plan in order, track pinned watches, inspect the speculative simulation and its effects, choose how the plan runs, and follow submission status and receipts.

To start working with a contract:

1. In Explore, add a contract: select an RPC provider for read-only access or enable the browser wallet for state-changing calls, confirm the displayed chain, enter the address, and resolve its interface (automatic verified-ABI lookup, JSON ABI, Solidity declarations, a preset, or none for raw-only access).
2. Expand a function (or use the raw call), complete its inputs, and run the read — or choose **Send now** for one transaction, or **Add to execution** to compose it into the plan.
3. Open Execution (directly, or through the Review actions in Explore) to see what will run, in which order, under which account and chain, and what it is expected to do before anything is submitted.

State-changing ABI functions and raw calls provide two distinct actions: **Send now** and **Add to execution**. The plan is bound to the wallet account and chain that created it. A matching draft restored after refresh is immediately usable. Changing account or network clears unsubmitted drafts; submitted or otherwise unresolved batches remain locked until their original wallet session returns or the user explicitly forgets their tracking state.

If immediate gas estimation returns the standardized ERC-20 insufficient-allowance error, Intereth can validate a user-confirmed token approval before retrying. The approval and transaction may be added to the execution plan, or the approval may be confirmed separately before an explicit retry. An advanced **Send anyway** action uses simulated target-only gas and warns that the transaction is still expected to revert unless an approval becomes effective first.

Changing accounts on the same network keeps wallet-backed contract cards, rebinds them to the new signer, and resets their interaction forms. Changing networks removes wallet-backed cards from the previous network. Explicit read-only RPC contract cards stay pinned to their configured network in both cases. Disconnecting pauses wallet interactions without clearing their forms.

## Execution and simulation

Every call exposes its actions directly instead of switching the application into a separate mode. State-changing functions and raw calls offer **Send now** through the connected wallet and **Add to execution** into the plan. Read functions always offer **Run on-chain** against canonical state; whenever plan-state simulation is ready for the current plan, **Run speculative** additionally executes the read after the plan calls without sending anything. Read calls can also be pinned as watches; Intereth recomputes their base-block and speculative values whenever the plan or the watches change, and shows them side by side in the Execution view.

The Execution view combines the ordered plan with a speculative preview and, once a simulation snapshot exists, decoded per-call results, events, reverts, gas, balance changes, and optional raw RPC details alongside the execution controls. All simulated values are speculative and are labeled separately from canonical values.

Predefined chain `rpcUrl` endpoints are preferred for simulation and must support `eth_simulateV1`. Once a plan exists, Intereth also checks the connected wallet's RPC and uses it as a fallback, including on networks outside the predefined list. Plan previews and watches use one pinned base block per snapshot so their comparisons share the same canonical starting state.

## Atomic execution plans

Intereth queries the connected wallet's [EIP-5792](https://eips.ethereum.org/EIPS/eip-5792) `atomic` capability when the Execution view is opened. It submits a plan only when the wallet reports one of these states:

- `supported`: the wallet already guarantees atomic and contiguous execution.
- `ready`: the wallet can enable those guarantees with user approval. This can involve installing a persistent [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) delegation, so Intereth shows an additional warning before opening the wallet.

Every batch is sent with `atomicRequired: true`. Intereth does not silently fall back to sequential execution. If the capability is unsupported, unavailable, or rejected, transactions can still be sent individually with **Send now** from their original function or raw-call forms, or one at a time through sequential plan execution.

After submission, the plan is locked and its EIP-5792 batch identifier is stored locally. Pending batches are polled while the matching wallet account and network are active — including while Explore is shown and after a refresh; status can also be refreshed manually or opened in the wallet. Confirmed receipts are shown in the plan. Off-chain failures and complete reverts may be turned back into an editable retry draft only after explicit confirmation. Partial execution or malformed/non-atomic wallet responses remain frozen for manual review and are never resubmitted automatically.

The execution plan contains public addresses, calldata, values, and wallet status data in browser local storage. It never stores private keys or wallet authorization signatures. Clearing site data removes the saved plan.

Custom RPC endpoints are validated before use. Their full URLs are displayed in the interface, including any embedded API keys, so avoid exposing the page in screenshots or screen shares when using credentialed URLs.

Automatic ABI lookup is opt-in and sends the public contract address and chain ID to Sourcify, then to the configured public Blockscout instance when necessary. Lookup is available only for contracts verified by one of those services.

Always verify the contract address, network, function arguments, and wallet transaction preview before signing.

## Development

Requires Node.js 22.12+, 24.x, or 26+ and npm.

```bash
npm install
npm run dev
```

The development server runs at [http://localhost:5173/intereth/](http://localhost:5173/intereth/).

```bash
npm test              # run the test suite once (Vitest)
npm run test:watch    # interactive test watcher
npm run typecheck     # TypeScript check only
npm run lint          # ESLint
npm run build         # typecheck + production build
```

The production build is written to `dist/` and uses `/intereth/` as its GitHub Pages base path. Inspect the production bundle locally with `npm run preview`.

## Deployment

The `base` setting in `vite.config.ts` controls the GitHub Pages URL. To build and publish the `dist/` directory to the `gh-pages` branch:

```bash
npm run deploy
```
