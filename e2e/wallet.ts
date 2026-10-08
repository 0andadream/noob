/** Browser EIP-1193 provider. Forwards chain calls to local Anvil and records add-chain requests. */
export function installMockWallet() {
  const address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  let chainId = "0x1";
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const target = window as Window & {
    ethereum?: unknown;
    __noobAddedChain?: unknown;
    __noobWatched?: unknown;
  };

  function emit(event: string, ...args: unknown[]) {
    for (const listener of listeners.get(event) ?? []) listener(...args);
  }

  const provider = {
    isMetaMask: true,
    async request({ method, params }: { method: string; params?: unknown[] }) {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [address];
      if (method === "eth_chainId") return chainId;
      if (method === "net_version") return String(Number(chainId));
      if (method === "wallet_requestPermissions") {
        return [{ parentCapability: "eth_accounts", caveats: [{ type: "restrictReturnedAccounts", value: [address] }] }];
      }
      if (method === "wallet_revokePermissions") return null;
      if (method === "wallet_switchEthereumChain") {
        const next = String((params?.[0] as { chainId?: string } | undefined)?.chainId ?? "").toLowerCase();
        if (next !== "0x4c18" || chainId !== "0x4c18") {
          const error = new Error("Unrecognized chain ID") as Error & { code: number };
          error.code = 4902;
          throw error;
        }
        emit("chainChanged", chainId);
        return null;
      }
      if (method === "wallet_addEthereumChain") {
        const chain = params?.[0];
        target.__noobAddedChain = chain;
        const requested = String((chain as { chainId?: string } | undefined)?.chainId ?? "").toLowerCase();
        if (requested !== "0x4c18") throw new Error(`Unexpected chain ${requested}`);
        chainId = "0x4c18";
        emit("chainChanged", chainId);
        return null;
      }
      if (method === "wallet_watchAsset") {
        target.__noobWatched = params;
        return true;
      }
      const response = await fetch("http://127.0.0.1:8545", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const body = (await response.json()) as { error?: { code: number; message: string }; result?: unknown };
      if (body.error) {
        const error = new Error(body.error.message) as Error & { code: number };
        error.code = body.error.code;
        throw error;
      }
      return body.result;
    },
    on(event: string, listener: (...args: unknown[]) => void) {
      const list = listeners.get(event) ?? [];
      list.push(listener);
      listeners.set(event, list);
    },
    removeListener(event: string, listener: (...args: unknown[]) => void) {
      listeners.set(event, (listeners.get(event) ?? []).filter((item) => item !== listener));
    },
  };
  provider.removeListener = provider.removeListener.bind(provider);
  (provider as { off?: typeof provider.removeListener }).off = provider.removeListener;
  target.ethereum = provider;
}
