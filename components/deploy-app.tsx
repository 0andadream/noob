"use client";

import { encodeDeployData, type Hex } from "viem";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Connector } from "wagmi";
import {
  useBalance,
  useConnect,
  useConnectors,
  useConnection,
  useDeployContract,
  useDisconnect,
  useEstimateGas,
  useGasPrice,
  useReadContracts,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWalletClient,
} from "wagmi";
import {
  QMS_CHAIN_ID,
  QMS_DOCS_URL,
  QMS_FAUCET_URL,
  QMS_STATUS_URL,
  explorerAddress,
  explorerTx,
  qmsTestnet,
} from "@/lib/chain";
import { explainError } from "@/lib/errors";
import { formatQms, formatTokenAmount, shortAddress } from "@/lib/format";
import {
  TOKEN_DECIMALS,
  bytecodeFor,
  constructorAbi,
  erc20ReadAbi,
  summarize,
  validate,
  type ValidToken,
} from "@/lib/token";
import { walletLabel } from "@/lib/wallets";
import { Mark } from "./mark";

const inputClass =
  "mt-2 h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-ink";

export function DeployApp() {
  const connection = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const deploy = useDeployContract();
  const [wallets, setWallets] = useState<Array<{ connector: Connector; label: string }> | null>(
    null,
  );
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState("");
  const [mintable, setMintable] = useState(false);
  const [burnable, setBurnable] = useState(false);
  const [blurred, setBlurred] = useState({ name: false, symbol: false, supply: false });
  const [signed, setSigned] = useState<ValidToken | null>(null);
  const attemptedFor = useRef<string | null>(null);

  const draft = useMemo(
    () => ({ name, symbol, supply, mintable, burnable }),
    [name, symbol, supply, mintable, burnable],
  );
  const { value: token, errors } = useMemo(() => validate(draft), [draft]);
  const onQms = connection.chainId === qmsTestnet.id;
  const balance = useBalance({
    address: connection.address,
    chainId: qmsTestnet.id,
    query: { enabled: Boolean(connection.address), refetchInterval: 12_000 },
  });
  const deployData = token
    ? encodeDeployData({
        abi: constructorAbi,
        bytecode: bytecodeFor(token),
        args: [token.name, token.symbol, token.supplyWei],
      })
    : undefined;
  const canEstimate = Boolean(
    deployData && connection.address && onQms && balance.data && balance.data.value > 0n,
  );
  const gas = useEstimateGas({
    account: connection.address,
    chainId: qmsTestnet.id,
    data: (deployData ?? "0x") as Hex,
    query: { enabled: canEstimate },
  });
  const gasPrice = useGasPrice({
    chainId: qmsTestnet.id,
    query: { enabled: Boolean(gas.data) },
  });
  const fee = gas.data !== undefined && gasPrice.data !== undefined ? gas.data * gasPrice.data : undefined;

  const hash = deploy.data;
  const receipt = useWaitForTransactionReceipt({
    hash,
    chainId: qmsTestnet.id,
    // QMS Testnet has no finality yet. One mined block is the confirmation.
    confirmations: 1,
    pollingInterval: 2_000,
    query: { enabled: Boolean(hash) },
  });
  const contractAddress = receipt.data?.contractAddress ?? undefined;
  const publishing = Boolean(hash && receipt.isFetching && !contractAddress);
  const busy = deploy.isPending || publishing;
  const problem = deploy.error ?? (hash ? receipt.error : null);

  useEffect(() => {
    let cancelled = false;
    async function loadWallets() {
      const ready: Array<{ connector: Connector; label: string }> = [];
      const seen = new Set<string>();
      for (const connector of connectors) {
        const provider = await connector.getProvider().catch(() => undefined);
        if (!provider) continue;
        const label = walletLabel(provider, connector.name);
        if (seen.has(label)) continue;
        seen.add(label);
        ready.push({ connector, label });
      }
      if (!cancelled) setWallets(ready);
    }
    void loadWallets();
    return () => {
      cancelled = true;
    };
  }, [connectors]);

  useEffect(() => {
    if (!connection.isConnected || !connection.address || onQms) return;
    if (attemptedFor.current === connection.address) return;
    attemptedFor.current = connection.address;
    switchChain.mutate({ chainId: qmsTestnet.id });
  }, [connection.address, connection.isConnected, onQms, switchChain]);

  function blur(field: keyof typeof blurred) {
    setBlurred((current) => ({ ...current, [field]: true }));
  }

  function onDeploy() {
    setBlurred({ name: true, symbol: true, supply: true });
    if (!token || !connection.isConnected || !onQms || balance.data?.value === 0n || busy) return;
    setSigned(token);
    deploy.mutate({
      abi: constructorAbi,
      bytecode: bytecodeFor(token),
      args: [token.name, token.symbol, token.supplyWei],
      chainId: qmsTestnet.id,
    });
  }

  const summary = token
    ? [
        ...summarize(token),
        ...(fee !== undefined ? [`The network fee is about ${formatQms(fee)} test QMS.`] : []),
      ]
    : [];

  const balanceZero = balance.data?.value === 0n;
  let blocker = "";
  if (!connection.isConnected) blocker = "Connect a wallet to deploy.";
  else if (!onQms) blocker = "Switch to QMS Testnet to deploy.";
  else if (balance.isPending) blocker = "Checking your test QMS balance…";
  else if (balanceZero) blocker = "Get test QMS for the network fee, then deploy.";
  else if (!token) blocker = "Finish the form to deploy.";

  const done = Boolean(hash && contractAddress && signed);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8 sm:py-12">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-ink">
          <Mark />
          <span className="text-xl font-semibold tracking-tight">Noob</span>
        </div>
        <p className="rounded-full border border-line bg-card px-3 py-1 text-sm text-muted">
          QMS Testnet
        </p>
      </header>

      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Deploy a token without writing code.
        </h1>
        <p className="max-w-xl text-base leading-7 text-muted">
          Your wallet signs the transaction. The token belongs to you.
        </p>
      </div>

      <p
        role="note"
        className="rounded-2xl border border-warn-line bg-warn px-4 py-3 text-sm leading-6 text-warn-ink"
      >
        QMS Testnet only. Tokens you deploy here have no money value, and the test network can be
        reset. You sign with your own wallet. Noob never sees your private key. Anyone who has
        that key controls the tokens.
      </p>

      <Step n="1" title="Connect your wallet">
        <WalletSection
          connected={connection.isConnected}
          address={connection.address}
          onQms={onQms}
          wallets={wallets}
          connecting={connect.isPending}
          switching={switchChain.isPending}
          balanceText={
            balance.data
              ? `${formatQms(balance.data.value)} test QMS`
              : balance.isFetching
                ? "Checking…"
                : connection.isConnected
                  ? "Could not read the balance"
                  : null
          }
          balanceZero={balanceZero}
          switchError={switchChain.error ? explainError(switchChain.error) : null}
          connectError={connect.error ? explainError(connect.error) : null}
          onConnect={(connector) => connect.mutate({ connector, chainId: qmsTestnet.id })}
          onDisconnect={() => disconnect.mutate()}
          onSwitch={() => switchChain.mutate({ chainId: qmsTestnet.id })}
        />
      </Step>

      {done && hash && contractAddress && signed ? (
        <SuccessPanel
          address={contractAddress}
          hash={hash}
          token={signed}
          onAnother={() => {
            deploy.reset();
            setSigned(null);
          }}
        />
      ) : (
        <>
          <Step n="2" title="Choose a template">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer gap-3 rounded-xl border-2 border-ink bg-white p-4">
                <input
                  className="mt-1"
                  type="radio"
                  name="template"
                  value="erc20"
                  checked
                  onChange={() => {}}
                />
                <span>
                  <span className="block font-semibold">Token</span>
                  <span className="mt-1 block text-sm leading-5 text-muted">
                    ERC-20. A name, a ticker, and a supply of identical tokens.
                  </span>
                </span>
              </label>
              <label className="flex cursor-not-allowed gap-3 rounded-xl border border-line bg-paper p-4 opacity-70">
                <input type="radio" name="template" value="erc721" disabled className="mt-1" />
                <span>
                  <span className="block font-semibold">Collectible</span>
                  <span className="mt-1 block text-sm leading-5 text-muted">
                    ERC-721. Not in this version.
                  </span>
                </span>
              </label>
            </div>
          </Step>

          <Step n="3" title="Describe the token">
            <div className="space-y-5">
              <Field
                id="token-name"
                label="Name"
                hint="The full name people will see. Example: Maple Token."
                error={blurred.name ? errors.name : undefined}
              >
                <input
                  id="token-name"
                  className={inputClass}
                  value={name}
                  maxLength={64}
                  autoComplete="off"
                  disabled={busy}
                  aria-invalid={Boolean(blurred.name && errors.name)}
                  onBlur={() => blur("name")}
                  onChange={(event) => setName(event.target.value.replace(/[\r\n]/g, ""))}
                />
              </Field>
              <Field
                id="token-symbol"
                label="Symbol"
                hint="A short ticker, up to 11 letters or numbers. Example: MAPLE."
                error={blurred.symbol ? errors.symbol : undefined}
              >
                <input
                  id="token-symbol"
                  className={inputClass}
                  value={symbol}
                  maxLength={11}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  disabled={busy}
                  aria-invalid={Boolean(blurred.symbol && errors.symbol)}
                  onBlur={() => blur("symbol")}
                  onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                />
              </Field>
              <Field
                id="token-supply"
                label="Total supply"
                hint="Whole tokens your wallet receives. Each token has 18 decimal places, same as most tokens. You do not type the extra zeros."
                error={blurred.supply ? errors.supply : undefined}
              >
                <input
                  id="token-supply"
                  className={inputClass}
                  value={supply}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={24}
                  disabled={busy}
                  aria-invalid={Boolean(blurred.supply && errors.supply)}
                  onBlur={() => blur("supply")}
                  onChange={(event) => setSupply(event.target.value.replace(/[^\d,]/g, ""))}
                />
              </Field>

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold">Optional</legend>
                <Toggle
                  checked={mintable}
                  disabled={busy}
                  title="Let me create more tokens later"
                  detail="Only the owner can do this. There is no supply cap. Leave this off for a fixed supply."
                  onChange={setMintable}
                />
                <Toggle
                  checked={burnable}
                  disabled={busy}
                  title="Let holders destroy their own tokens"
                  detail="Destroying tokens lowers the supply. No one can destroy tokens they do not hold, unless the holder approved them."
                  onChange={setBurnable}
                />
              </fieldset>
            </div>
          </Step>

          <Step n="4" title="Check this before you sign">
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                onDeploy();
              }}
            >
              {summary.length > 0 ? (
                <ul className="space-y-2 text-sm leading-6" data-testid="summary">
                  {summary.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm leading-6 text-muted">
                  Finish the form to see what you will own and what the token can do.
                </p>
              )}

              <ol className="space-y-1 text-sm leading-6 text-muted">
                <li>1. Your wallet opens.</li>
                <li>2. You approve the transaction there.</li>
                <li>3. QMS Testnet publishes the token and gives you the address.</li>
              </ol>

              {blocker ? <p className="text-sm text-muted">{blocker}</p> : null}
              {problem ? (
                <div role="alert" className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">
                  <p>{explainError(problem)}</p>
                </div>
              ) : null}
              {publishing && hash ? (
                <p className="text-sm leading-6">
                  The transaction is signed. Waiting for QMS Testnet to publish it.{" "}
                  <a className="font-semibold text-accent" href={explorerTx(hash)} target="_blank" rel="noreferrer">
                    View the transaction
                  </a>
                </p>
              ) : null}

              <button
                type="submit"
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-accent px-4 text-base font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-50"
                disabled={Boolean(blocker) || busy}
              >
                {deploy.isPending
                  ? "Waiting for your wallet…"
                  : publishing
                    ? "Publishing to QMS Testnet…"
                    : "Sign and deploy"}
              </button>
              <p className="text-sm leading-6 text-muted">
                Noob cannot approve this for you, and it cannot move the tokens afterward.
              </p>
            </form>
          </Step>
        </>
      )}

      <footer className="flex flex-wrap gap-x-4 gap-y-2 pb-6 text-sm text-muted">
        <a className="underline" href="https://github.com/0andadream/noob" target="_blank" rel="noreferrer">
          Source
        </a>
        <a className="underline" href={QMS_DOCS_URL} target="_blank" rel="noreferrer">
          QMS docs
        </a>
        <a className="underline" href={QMS_FAUCET_URL} target="_blank" rel="noreferrer">
          Faucet
        </a>
        <a className="underline" href={QMS_STATUS_URL} target="_blank" rel="noreferrer">
          Status
        </a>
        <span>Chain ID {QMS_CHAIN_ID}</span>
      </footer>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-5 sm:p-6">
      <h2 className="flex items-center gap-3 text-lg font-semibold">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-sm text-paper">{n}</span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <p id={`${id}-hint`} className="mt-1 text-sm leading-5 text-muted">
        {hint}
      </p>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  title,
  detail,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  title: string;
  detail: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex gap-3 rounded-xl border border-line bg-white p-4">
      <input
        type="checkbox"
        className="mt-1 h-5 w-5"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-muted">{detail}</span>
      </span>
    </label>
  );
}

function WalletSection({
  connected,
  address,
  onQms,
  wallets,
  connecting,
  switching,
  balanceText,
  balanceZero,
  switchError,
  connectError,
  onConnect,
  onDisconnect,
  onSwitch,
}: {
  connected: boolean;
  address?: `0x${string}`;
  onQms: boolean;
  wallets: Array<{ connector: Connector; label: string }> | null;
  connecting: boolean;
  switching: boolean;
  balanceText: string | null;
  balanceZero: boolean;
  switchError: string | null;
  connectError: string | null;
  onConnect: (connector: Connector) => void;
  onDisconnect: () => void;
  onSwitch: () => void;
}) {
  if (!connected || !address) {
    return (
      <div className="space-y-3">
        <p className="text-sm leading-6 text-muted">
          Use a browser wallet such as MetaMask or Rabby. You will need a little test QMS to pay
          the network fee.
        </p>
        {wallets === null ? (
          <p className="text-sm">Looking for a wallet…</p>
        ) : wallets.length === 0 ? (
          <a
            className="inline-flex h-12 items-center justify-center rounded-xl bg-ink px-4 text-sm font-semibold text-paper"
            href="https://metamask.io/download/"
            target="_blank"
            rel="noreferrer"
          >
            Install MetaMask
          </a>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            {wallets.map(({ connector, label }) => (
              <button
                key={connector.uid}
                type="button"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-ink px-4 text-sm font-semibold text-paper disabled:opacity-50"
                disabled={connecting}
                onClick={() => onConnect(connector)}
              >
                {connecting ? "Waiting for your wallet…" : `Connect ${label}`}
              </button>
            ))}
          </div>
        )}
        {connectError ? <p className="text-sm text-danger">{connectError}</p> : null}
        <p className="text-sm leading-6">
          <a className="font-semibold text-accent" href={QMS_FAUCET_URL} target="_blank" rel="noreferrer">
            Get test QMS
          </a>
          <span className="text-muted"> — free tokens for the network fee. They have no money value.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm leading-6">
      <p>
        <span className="text-muted">Wallet </span>
        <span className="font-mono" title={address}>
          {shortAddress(address)}
        </span>{" "}
        <CopyText value={address} label="Copy address" />
      </p>
      <p>{onQms ? "Network: QMS Testnet" : "Network: not QMS Testnet"}</p>
      {balanceText ? <p>Fee balance: {balanceText}</p> : null}
      {balanceZero ? (
        <p>Your test QMS balance is 0, so the network cannot publish a contract yet.</p>
      ) : null}
      <p>
        <a className="font-semibold text-accent" href={QMS_FAUCET_URL} target="_blank" rel="noreferrer">
          Get test QMS
        </a>
        <span className="text-muted">
          {" "}
          — the faucet asks for your address. Copy it above and paste it there. Limit of 4 requests
          a day. Test QMS has no money value.
        </span>
      </p>
      {!onQms ? (
        <div className="space-y-2">
          <p>If QMS Testnet is missing, your wallet will ask to add it. Chain ID {QMS_CHAIN_ID}.</p>
          <button
            type="button"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-white px-4 font-semibold disabled:opacity-50"
            disabled={switching}
            onClick={onSwitch}
          >
            {switching ? "Waiting for your wallet…" : "Switch to QMS Testnet"}
          </button>
          {switchError ? <p className="text-danger">{switchError}</p> : null}
        </div>
      ) : null}
      <button type="button" className="font-semibold text-muted underline" onClick={onDisconnect}>
        Disconnect
      </button>
    </div>
  );
}

function SuccessPanel({
  address,
  hash,
  token,
  onAnother,
}: {
  address: `0x${string}`;
  hash: `0x${string}`;
  token: ValidToken;
  onAnother: () => void;
}) {
  const wallet = useWalletClient({ chainId: qmsTestnet.id });
  const reads = useReadContracts({
    allowFailure: true,
    contracts: [
      { address, abi: erc20ReadAbi, chainId: qmsTestnet.id, functionName: "name" },
      { address, abi: erc20ReadAbi, chainId: qmsTestnet.id, functionName: "symbol" },
      { address, abi: erc20ReadAbi, chainId: qmsTestnet.id, functionName: "totalSupply" },
    ],
  });
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const confirmedName = reads.data?.[0]?.status === "success" ? String(reads.data[0].result) : null;
  const confirmedSymbol = reads.data?.[1]?.status === "success" ? String(reads.data[1].result) : null;
  const confirmedSupply =
    reads.data?.[2]?.status === "success" && typeof reads.data[2].result === "bigint"
      ? reads.data[2].result
      : null;
  const symbol = confirmedSymbol ?? token.symbol;

  async function addToken() {
    if (!wallet.data) {
      setAddError("Open the wallet that deployed this token, then try again.");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const ok = await wallet.data.watchAsset({
        type: "ERC20",
        options: { address, decimals: TOKEN_DECIMALS, symbol },
      });
      if (ok) setAdded(true);
      else setAddError("The wallet did not add the token.");
    } catch (error) {
      setAddError(explainError(error));
    } finally {
      setAdding(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-card p-5 sm:p-6">
      <h2 className="text-2xl font-semibold tracking-tight">Your token is on QMS Testnet.</h2>
      {confirmedName && confirmedSymbol && confirmedSupply !== null ? (
        <p className="text-sm leading-6">
          The contract says this is {confirmedName} ({confirmedSymbol}), with a supply of{" "}
          {formatTokenAmount(confirmedSupply)}.
        </p>
      ) : (
        <p className="text-sm leading-6 text-muted">Reading the token from QMS Testnet…</p>
      )}
      <p className="text-sm leading-6">
        {token.mintable
          ? "Your wallet holds the starting supply, and it is the owner."
          : "Your wallet holds the whole supply. No one can create more."}
      </p>
      <div>
        <p className="text-sm font-semibold">Contract address</p>
        <p className="mt-1 font-mono text-sm break-all" data-testid="contract-address">
          {address}
        </p>
        <CopyText value={address} label="Copy contract address" />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <a
          className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-white px-4 text-sm font-semibold"
          href={explorerAddress(address)}
          target="_blank"
          rel="noreferrer"
        >
          View on QMSScan
        </a>
        <button
          type="button"
          className="inline-flex h-12 items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-50"
          disabled={added || adding}
          onClick={() => void addToken()}
        >
          {added ? "Added to your wallet" : adding ? "Waiting for your wallet…" : `Add ${symbol} to wallet`}
        </button>
      </div>
      {addError ? <p className="text-sm text-danger">{addError}</p> : null}
      <p className="text-sm">
        <a className="font-semibold text-accent" href={explorerTx(hash)} target="_blank" rel="noreferrer">
          View the transaction
        </a>
      </p>
      <button type="button" className="text-sm font-semibold underline" onClick={onAnother}>
        Deploy another
      </button>
    </section>
  );
}

function CopyText({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="font-semibold text-accent"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        });
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
