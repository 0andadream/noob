# Noob

Noob lets a beginner deploy a token on [QMS Testnet](https://docs.qms.finance/for-developers/network-and-rpc) without writing code.

You connect a browser wallet, fill in a short form, and sign the deployment yourself. Noob never holds a private key and never sends a transaction on your behalf. The tokens are test tokens. They have no money value, and QMS Testnet can be reset.

This version deploys ERC-20 tokens. An ERC-721 collectible is shown in the template list and is not deployable yet. There is no free-form Solidity input.

## Network

| | |
| --- | --- |
| Network | QMS Testnet |
| Chain ID | 19480 |
| RPC | https://rpc.testnet.qms.finance |
| Currency | QMS |
| Explorer | https://testnet.qmsscan.io |
| Faucet | https://faucet.testnet.qms.finance |

If the wallet does not already have QMS Testnet, connecting asks it to add the network and switch to it.

## Run

```bash
npm install
npm run dev
```

Open the app, connect MetaMask, Rabby, or another injected wallet, and get test QMS from the faucet. The faucet sends 10 test QMS per request, up to 4 requests a day.

## What gets deployed

The form compiles nothing in the browser. It deploys one of four contracts that were compiled ahead of time from OpenZeppelin Contracts v5.6.1. The creation bytecode is in `lib/erc20-artifacts.ts`. The constructor arguments are the name, the symbol, and the supply in 18-decimal units.

| Choice | Contract | What it can do |
| --- | --- | --- |
| Neither toggle | `NoobToken` | Fixed supply, minted to the deployer. No owner. |
| Burnable | `NoobTokenBurnable` | Holders can destroy their own tokens. No owner. |
| Mintable | `NoobTokenMintable` | The owner can mint more. There is no cap. |
| Both | `NoobTokenMintableBurnable` | Owner mint, plus holder burn. |

Source is in `src/`. The deployer receives the initial supply. On the mintable contracts, the deployer is the first owner and can transfer or renounce ownership. Nobody can freeze a wallet or move tokens that wallet has not approved.

Solidity 0.8.30, optimizer 200 runs, EVM version `cancun`. QMS Testnet runs the Osaka hard fork, which accepts that bytecode. QMS does not have finality yet, so Noob waits for one mined block rather than a finalized block.

Regenerate the bytecode after a contract change:

```bash
npm run contracts:export
```

That needs [Foundry](https://book.getfoundry.sh/) and `npm install`, because the OpenZeppelin sources come from `node_modules`. `lib/forge-std` is a git submodule used only by the contract tests.

## Test

```bash
npm test
```

`npm test` runs the Forge contract tests, checks that the committed bytecode matches the build, and deploys each variant on a local Anvil chain with id 19480.

```bash
npm run test:e2e
```

The browser test starts Anvil and the app, connects a mock wallet, checks that QMS Testnet is added, and deploys a token through the form. It uses Chrome.

`NEXT_PUBLIC_QMS_RPC_URL` overrides the RPC for that local Anvil run. The chain id stays 19480. Leave it unset to use the public QMS Testnet RPC.
