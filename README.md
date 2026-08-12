# Intereth

Intereth is a browser-based interface for inspecting and calling EVM smart contracts. Provide a contract address, ABI, and RPC endpoint for read-only access, or connect a browser wallet to send transactions.

Live app: [borosorus.github.io/intereth](https://borosorus.github.io/intereth)

## Features

- Works with predefined networks or any custom HTTP RPC endpoint.
- Includes Ethereum examples for WETH, ENS Registry, and Uniswap V3 Factory.
- Provides editable ERC-20, ERC-721, and ERC-1155 ABI presets.
- Supports nested tuples, arrays, raw calldata, payable calls, and transaction values.
- Formats unsigned integer inputs as wei, gwei, or ETH while previewing the final integer value.
- Shows the active RPC URL and chain ID on read-only contract instances.
- Builds an ordered, browser-persisted transaction plan without opening the wallet.
- Sends compatible plans as atomic wallet batches through EIP-5792.
- Separates execution-focused Interact mode from a technical Simulate workspace with speculative reads and watches.
- Decodes simulated events, reverts, return data, and supported ERC-20/native balance changes.

## Usage

1. Enter a contract address or choose an example to prefill the form.
2. Paste a JSON ABI or a JSON array of human-readable fragments, select a preset, or leave it empty for raw calls only.
3. Select an RPC provider for read-only calls, or enable the browser wallet for state-changing calls.
4. Add the instance, expand a function, complete its inputs, and run the call.

State-changing ABI functions and raw calls provide two actions: **Add to queue** and **Send immediately**. The queue is bound to the wallet account and chain that created it. A matching draft restored after refresh is immediately usable. Changing account or network clears unsubmitted drafts; submitted or otherwise unresolved batches remain locked until their original wallet session returns or the user explicitly forgets their tracking state.

If immediate gas estimation returns the standardized ERC-20 insufficient-allowance error, Intereth can validate a user-confirmed token approval before retrying. The approval and transaction may be added to the atomic plan, or the approval may be confirmed separately before an explicit retry. An advanced **Send anyway** action uses simulated target-only gas and warns that the transaction is still expected to revert unless an approval becomes effective first.

Changing accounts on the same network keeps wallet-backed contract cards, rebinds them to the new signer, and resets their interaction forms. Changing networks removes wallet-backed cards from the previous network. Explicit read-only RPC contract cards stay pinned to their configured network in both cases. Disconnecting pauses wallet interactions without clearing their forms.

## Workspace modes and simulation

**Interact** is the default execution workspace. Reads use canonical on-chain state, while queued writes receive a compact speculative preview before wallet execution.

**Simulate** is the technical workspace. Reads can run after the queued writes without sending anything, and an explicit **Run on-chain** action remains available. Writes can be added to the shared queue, but transaction submission stays in Interact. Read calls can also be pinned as watches; Intereth recomputes their base-block and speculative values whenever the queue changes. The transaction-plan drawer provides decoded per-call results, events, reverts, gas, balance changes, and optional raw RPC details. All simulated values are speculative and are labeled separately from canonical values.

Predefined chain `rpcUrl` endpoints are preferred for simulation and must support `eth_simulateV1`. In Simulate mode, Intereth also checks the connected wallet's RPC and uses it as a fallback, including on networks outside the predefined list. Queue previews and watches use one pinned base block per snapshot so their comparisons share the same canonical starting state.

## Atomic transaction plans

Intereth queries the connected wallet's [EIP-5792](https://eips.ethereum.org/EIPS/eip-5792) `atomic` capability only when the transaction-plan review is opened. It submits a queue only when the wallet reports one of these states:

- `supported`: the wallet already guarantees atomic and contiguous execution.
- `ready`: the wallet can enable those guarantees with user approval. This can involve installing a persistent [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) delegation, so Intereth shows an additional warning before opening the wallet.

Every batch is sent with `atomicRequired: true`. Intereth does not silently fall back to sequential queue execution. If the capability is unsupported, unavailable, or rejected, transactions can still be sent individually with **Send immediately** from their original function or raw-call forms.

After submission, the plan is locked and its EIP-5792 batch identifier is stored locally. Pending batches are polled while the matching wallet account and network are active, including after a refresh; status can also be refreshed manually or opened in the wallet. Confirmed receipts are shown in the plan. Off-chain failures and complete reverts may be turned back into an editable retry draft only after explicit confirmation. Partial execution or malformed/non-atomic wallet responses remain frozen for manual review and are never resubmitted automatically.

The transaction plan contains public addresses, calldata, values, and wallet status data in browser local storage. It never stores private keys or wallet authorization signatures. Clearing site data removes the saved plan.

Custom RPC endpoints are validated before use. Their full URLs are displayed in the interface, including any embedded API keys, so avoid exposing the page in screenshots or screen shares when using credentialed URLs.

Always verify the contract address, network, function arguments, and wallet transaction preview before signing.

## Development

Requires Node.js and npm.

```bash
npm install
npm start
```

The development server runs at [http://localhost:3000](http://localhost:3000).

```bash
npm test -- --watchAll=false
npm run build
```

The production build is written to `build/` and uses `/intereth/` as its GitHub Pages base path.

## Deployment

The `homepage` field in `package.json` controls the GitHub Pages URL. To build and publish the `build/` directory to the `gh-pages` branch:

```bash
npm run deploy
```
