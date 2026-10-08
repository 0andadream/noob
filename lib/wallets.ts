type WalletFlags = {
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
  isOkxWallet?: boolean;
  isBraveWallet?: boolean;
  isMetaMask?: boolean;
};

export function walletLabel(provider: unknown, fallback: string): string {
  const flags = provider as WalletFlags;
  if (flags?.isRabby) return "Rabby";
  if (flags?.isCoinbaseWallet) return "Coinbase Wallet";
  if (flags?.isOkxWallet) return "OKX Wallet";
  if (flags?.isBraveWallet && !flags?.isMetaMask) return "Brave Wallet";
  if (flags?.isMetaMask) return "MetaMask";
  if (fallback && fallback !== "Injected") return fallback;
  return "Browser wallet";
}
