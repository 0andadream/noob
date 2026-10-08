import assert from "node:assert/strict";
import { type ChildProcess, spawn } from "node:child_process";
import { after, before, test } from "node:test";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { qmsTestnet } from "../lib/chain";
import { erc20Artifacts } from "../lib/erc20-artifacts";
import { constructorAbi, erc20ReadAbi } from "../lib/token";

const port = 18545;
const rpc = `http://127.0.0.1:${port}`;
const anvilChain = defineChain({
  ...qmsTestnet,
  rpcUrls: { default: { http: [rpc] } },
});
// Anvil's published account #0. This key is public and is only used against local Anvil.
const deployer = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const stranger = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");

const mintAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;
const burnAbi = [
  {
    type: "function",
    name: "burn",
    stateMutability: "nonpayable",
    inputs: [{ name: "value", type: "uint256" }],
    outputs: [],
  },
] as const;
const ownerAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

let anvil: ChildProcess;

async function waitForChain() {
  const started = Date.now();
  while (Date.now() - started < 10_000) {
    try {
      const response = await fetch(rpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      });
      const body = (await response.json()) as { result?: string };
      if (body.result === "0x4c18") return;
    } catch {
      // Anvil is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Anvil did not start");
}

before(async () => {
  anvil = spawn("anvil", ["--host", "127.0.0.1", "--port", String(port), "--chain-id", "19480", "--silent"], {
    stdio: "ignore",
  });
  await waitForChain();
});

after(() => {
  anvil?.kill("SIGTERM");
});

test("precompiled bytecode deploys the four token variants", { timeout: 30_000 }, async () => {
  const publicClient = createPublicClient({ chain: anvilChain, transport: http(rpc) });
  const wallet = createWalletClient({ account: deployer, chain: anvilChain, transport: http(rpc) });
  const supply = parseUnits("1000", 18);

  for (const [key, artifact] of Object.entries(erc20Artifacts)) {
    const hash = await wallet.deployContract({
      abi: constructorAbi,
      bytecode: artifact.bytecode,
      args: ["Maple", "MPL", supply],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    assert.ok(receipt.contractAddress);
    const address = receipt.contractAddress;
    assert.equal(await publicClient.readContract({ address, abi: erc20ReadAbi, functionName: "name" }), "Maple");
    assert.equal(await publicClient.readContract({ address, abi: erc20ReadAbi, functionName: "symbol" }), "MPL");
    assert.equal(await publicClient.readContract({ address, abi: erc20ReadAbi, functionName: "decimals" }), 18);
    assert.equal(await publicClient.readContract({ address, abi: erc20ReadAbi, functionName: "totalSupply" }), supply);

    if (key === "mintable" || key === "mintableBurnable") {
      assert.equal(await publicClient.readContract({ address, abi: ownerAbi, functionName: "owner" }), deployer.address);
      const mintHash = await wallet.writeContract({
        address,
        abi: mintAbi,
        functionName: "mint",
        args: [stranger.address, parseUnits("5", 18)],
      });
      await publicClient.waitForTransactionReceipt({ hash: mintHash });
      const strangerWallet = createWalletClient({ account: stranger, chain: anvilChain, transport: http(rpc) });
      await assert.rejects(() =>
        strangerWallet.writeContract({
          address,
          abi: mintAbi,
          functionName: "mint",
          args: [stranger.address, 1n],
        }),
      );
    }

    if (key === "burnable" || key === "mintableBurnable") {
      const burnHash = await wallet.writeContract({
        address,
        abi: burnAbi,
        functionName: "burn",
        args: [parseUnits("1", 18)],
      });
      await publicClient.waitForTransactionReceipt({ hash: burnHash });
    }
  }
});
