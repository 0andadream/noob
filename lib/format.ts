import { formatUnits } from "viem";

export function groupDigits(value: string): string {
  const [whole, frac] = value.split(".");
  const normalized = whole.replace(/^0+(?=\d)/, "") || "0";
  const grouped = normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${grouped}.${frac}` : grouped;
}

export function formatTokenAmount(value: bigint, decimals = 18): string {
  const raw = formatUnits(value, decimals);
  const [whole, frac = ""] = raw.split(".");
  const trimmed = frac.replace(/0+$/, "");
  return groupDigits(trimmed ? `${whole}.${trimmed}` : whole);
}

export function formatQms(value: bigint): string {
  const raw = formatUnits(value, 18);
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0 && numeric < 0.0001) return "less than 0.0001";
  if (!Number.isFinite(numeric)) return groupDigits(raw);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(numeric);
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
