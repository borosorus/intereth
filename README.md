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

## Usage

1. Enter a contract address or choose an example to prefill the form.
2. Paste a JSON ABI or a JSON array of human-readable fragments, select a preset, or leave it empty for raw calls only.
3. Select an RPC provider for read-only calls, or enable the browser wallet for state-changing calls.
4. Add the instance, expand a function, complete its inputs, and run the call.

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
