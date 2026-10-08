import { parseUnits, type Hex } from "viem";
import { erc20Artifacts } from "./erc20-artifacts";
import { groupDigits } from "./format";

export const TOKEN_DECIMALS = 18;
export const MAX_WHOLE_SUPPLY = 10n ** 15n;

export type Variant = keyof typeof erc20Artifacts;

export const constructorAbi = [
  {
    type: "constructor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name_", type: "string" },
      { name: "symbol_", type: "string" },
      { name: "initialSupply", type: "uint256" },
    ],
  },
] as const;

export const erc20ReadAbi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

export type TokenDraft = {
  name: string;
  symbol: string;
  supply: string;
  mintable: boolean;
  burnable: boolean;
};

export type ValidToken = {
  name: string;
  symbol: string;
  supply: string;
  supplyWei: bigint;
  mintable: boolean;
  burnable: boolean;
};

export type FieldErrors = {
  name?: string;
  symbol?: string;
  supply?: string;
};

export function artifactKey(features: { mintable: boolean; burnable: boolean }): Variant {
  if (features.mintable && features.burnable) return "mintableBurnable";
  if (features.mintable) return "mintable";
  if (features.burnable) return "burnable";
  return "fixed";
}

export function bytecodeFor(features: { mintable: boolean; burnable: boolean }): Hex {
  return erc20Artifacts[artifactKey(features)].bytecode;
}

export function validate(draft: TokenDraft): { value: ValidToken | null; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const name = draft.name.trim();
  if (!name) errors.name = "Give the token a name.";
  else if (name.length > 64) errors.name = "Use 64 characters or fewer.";
  else if (/[\u0000-\u001f\u007f]/.test(name)) {
    errors.name = "The name has a character this token cannot use.";
  }

  const symbol = draft.symbol.trim().toUpperCase();
  if (!symbol) errors.symbol = "Add a short ticker.";
  else if (!/^[A-Z0-9]{1,11}$/.test(symbol)) {
    errors.symbol = "Use 1 to 11 letters or numbers, with no spaces.";
  }

  const digits = draft.supply.replace(/,/g, "").trim();
  let supply = "";
  let supplyWei: bigint | null = null;
  if (!digits) errors.supply = "Enter how many tokens to create.";
  else if (!/^\d+$/.test(digits)) errors.supply = "Use a whole number, with no decimal point.";
  else {
    const amount = BigInt(digits);
    if (amount <= 0n) errors.supply = "Create at least 1 token.";
    else if (amount > MAX_WHOLE_SUPPLY) {
      errors.supply = `Use ${groupDigits(MAX_WHOLE_SUPPLY.toString())} or fewer.`;
    } else {
      supply = amount.toString();
      supplyWei = parseUnits(supply, TOKEN_DECIMALS);
    }
  }

  if (errors.name || errors.symbol || errors.supply || supplyWei === null) {
    return { value: null, errors };
  }

  return {
    value: {
      name,
      symbol,
      supply,
      supplyWei,
      mintable: draft.mintable,
      burnable: draft.burnable,
    },
    errors,
  };
}

export function summarize(token: ValidToken): string[] {
  const amount = groupDigits(token.supply);
  const lines = [
    `You are creating a test token called ${token.name} (${token.symbol}) on QMS Testnet.`,
    `Your wallet receives ${amount} ${token.symbol}. No other wallet receives any.`,
  ];

  if (token.mintable) {
    lines.push(
      `You can create more ${token.symbol} later and send the new tokens to any address. There is no supply cap.`,
      "Your wallet starts as the owner. The owner can create more tokens, hand ownership to another address, or give it up. Creating more tokens does not take tokens out of a wallet.",
    );
  } else {
    lines.push(
      `The supply is fixed at ${amount} ${token.symbol}. No one can create more, including you.`,
    );
  }

  if (token.burnable) {
    lines.push(
      `A holder can destroy ${token.symbol} they hold. That lowers the supply. Someone else can destroy them only after the holder approves it.`,
    );
  } else {
    lines.push("No one can destroy tokens.");
  }

  lines.push(
    "No one can freeze a wallet or move tokens that wallet has not approved.",
    "You pay a small network fee in test QMS. These tokens have no money value.",
    "You sign this in your wallet. Noob never sees your private key.",
  );
  return lines;
}
