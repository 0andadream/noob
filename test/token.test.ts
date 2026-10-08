import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { UserRejectedRequestError } from "viem";
import { erc20Artifacts } from "../lib/erc20-artifacts";
import { QMS_CHAIN_ID, QMS_DEFAULT_RPC_URL, QMS_FAUCET_URL, qmsRpcUrl, qmsTestnet } from "../lib/chain";
import { explainError } from "../lib/errors";
import { artifactKey, summarize, validate } from "../lib/token";

const base = { name: "Maple Token", symbol: "MAPLE", supply: "1000000", mintable: false, burnable: false };

test("defaults to the public QMS Testnet", () => {
  assert.equal(process.env.NEXT_PUBLIC_QMS_RPC_URL, undefined);
  assert.equal(qmsRpcUrl, QMS_DEFAULT_RPC_URL);
  assert.equal(qmsTestnet.id, QMS_CHAIN_ID);
  assert.equal(qmsTestnet.nativeCurrency.symbol, "QMS");
  assert.equal(qmsTestnet.blockExplorers.default.url, "https://testnet.qmsscan.io");
  assert.equal(QMS_FAUCET_URL, "https://faucet.testnet.qms.finance");
});

test("validates a beginner token form", () => {
  const ok = validate(base);
  assert.equal(ok.errors.name, undefined);
  assert.equal(ok.value?.supply, "1000000");
  assert.equal(ok.value?.supplyWei, 1_000_000n * 10n ** 18n);

  assert.equal(validate({ ...base, name: "  " }).errors.name, "Give the token a name.");
  assert.match(validate({ ...base, symbol: "NO OB" }).errors.symbol ?? "", /no spaces/);
  assert.equal(validate({ ...base, supply: "0" }).errors.supply, "Create at least 1 token.");
  assert.equal(validate({ ...base, supply: "1,000" }).value?.supply, "1000");
  assert.match(validate({ ...base, supply: "1000000000000001" }).errors.supply ?? "", /or fewer/);
});

test("summary stays in plain language and matches the toggles", () => {
  const fixed = validate(base).value;
  assert.ok(fixed);
  const fixedText = summarize(fixed).join(" ");
  assert.match(fixedText, /Your wallet receives 1,000,000 MAPLE/);
  assert.match(fixedText, /supply is fixed/);
  assert.match(fixedText, /No one can destroy tokens/);
  assert.match(fixedText, /no money value/);
  assert.match(fixedText, /never sees your private key/);

  const open = validate({ ...base, mintable: true, burnable: true }).value;
  assert.ok(open);
  const openText = summarize(open).join(" ");
  assert.match(openText, /no supply cap/);
  assert.match(openText, /hand ownership/);
  assert.match(openText, /holder can destroy/);
  assert.equal(artifactKey(open), "mintableBurnable");
  assert.equal(artifactKey({ mintable: true, burnable: false }), "mintable");
  assert.equal(artifactKey({ mintable: false, burnable: true }), "burnable");
  assert.equal(artifactKey({ mintable: false, burnable: false }), "fixed");
});

test("rejects a closed wallet in plain language", () => {
  const error = new UserRejectedRequestError(new Error("User rejected the request."));
  assert.match(explainError(error), /closed the wallet/);
});

test("committed bytecode matches the Forge build and the four variants differ", () => {
  const names = {
    fixed: "NoobToken",
    mintable: "NoobTokenMintable",
    burnable: "NoobTokenBurnable",
    mintableBurnable: "NoobTokenMintableBurnable",
  } as const;
  const codes = new Set<string>();
  for (const [key, contract] of Object.entries(names)) {
    const artifact = JSON.parse(readFileSync(`out/${contract}.sol/${contract}.json`, "utf8")) as {
      bytecode: { object: string };
      abi: Array<{ type: string; name?: string }>;
    };
    const variant = key as keyof typeof names;
    assert.equal(erc20Artifacts[variant].bytecode, artifact.bytecode.object);
    codes.add(artifact.bytecode.object);
    const fns = new Set(artifact.abi.filter((item) => item.type === "function").map((item) => item.name));
    assert.equal(fns.has("mint"), variant === "mintable" || variant === "mintableBurnable");
    assert.equal(fns.has("burn"), variant === "burnable" || variant === "mintableBurnable");
    assert.equal(fns.has("owner"), variant === "mintable" || variant === "mintableBurnable");
    assert.equal(fns.has("name"), true);
  }
  assert.equal(codes.size, 4);
  execSync("forge build", { stdio: "ignore" });
});
