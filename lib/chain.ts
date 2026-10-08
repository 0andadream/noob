import { defineChain } from "viem";

export const QMS_CHAIN_ID = 19480;
export const QMS_DEFAULT_RPC_URL = "https://rpc.testnet.qms.finance";
export const QMS_EXPLORER_URL = "https://testnet.qmsscan.io";
export const QMS_FAUCET_URL = "https://faucet.testnet.qms.finance";
export const QMS_STATUS_URL = "https://status.testnet.qms.finance";
export const QMS_DOCS_URL = "https://docs.qms.finance/for-developers/network-and-rpc";

/** Public QMS Testnet RPC, unless a local anvil is set for tests. */
export const qmsRpcUrl = process.env.NEXT_PUBLIC_QMS_RPC_URL ?? QMS_DEFAULT_RPC_URL;

export const qmsTestnet = defineChain({
  id: QMS_CHAIN_ID,
  name: "QMS Testnet",
  nativeCurrency: { name: "QMS", symbol: "QMS", decimals: 18 },
  rpcUrls: {
    default: { http: [qmsRpcUrl] },
  },
  blockExplorers: {
    default: { name: "QMSScan", url: QMS_EXPLORER_URL },
  },
  testnet: true,
});

export function explorerAddress(address: string): string {
  return `${QMS_EXPLORER_URL}/address/${address}`;
}

export function explorerTx(hash: string): string {
  return `${QMS_EXPLORER_URL}/tx/${hash}`;
}
