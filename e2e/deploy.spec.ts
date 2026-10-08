import { expect, test, type Page } from "@playwright/test";
import { createPublicClient, createWalletClient, defineChain, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { qmsTestnet } from "../lib/chain";
import { installMockWallet } from "./wallet";

const anvil = defineChain({
  ...qmsTestnet,
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
});
const deployer = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const stranger = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test("shows the warning and asks for a wallet", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("note")).toContainText("have no money value");
  await expect(page.getByRole("note")).toContainText("never sees your private key");
  await expect(page.getByRole("radio", { name: /Collectible/ })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Get test QMS" })).toHaveAttribute(
    "href",
    "https://faucet.testnet.qms.finance",
  );
  await expect(page.getByRole("link", { name: "Install MetaMask" })).toBeVisible();

  await page.getByRole("textbox", { name: "Name" }).fill("");
  await page.getByRole("textbox", { name: "Name" }).blur();
  await expect(page.getByText("Give the token a name.")).toBeVisible();
  await page.getByRole("textbox", { name: "Symbol" }).fill("NO OB");
  await page.getByRole("textbox", { name: "Symbol" }).blur();
  await expect(page.getByText("Use 1 to 11 letters or numbers, with no spaces.")).toBeVisible();
  await page.getByRole("textbox", { name: "Total supply" }).fill("0");
  await page.getByRole("textbox", { name: "Total supply" }).blur();
  await expect(page.getByText("Create at least 1 token.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign and deploy" })).toBeDisabled();

  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await noHorizontalOverflow(page);
  }
  await page.screenshot({ path: "/tmp/noob-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: "/tmp/noob-desktop.png", fullPage: true });
});

test("deploys a fixed-supply token from the connected wallet", async ({ page }) => {
  await page.addInitScript(installMockWallet);
  await page.goto("/");
  await page.getByRole("textbox", { name: "Name" }).fill("Playwright Token");
  await page.getByRole("textbox", { name: "Symbol" }).fill("play");
  await expect(page.getByRole("textbox", { name: "Symbol" })).toHaveValue("PLAY");
  await page.getByRole("textbox", { name: "Total supply" }).fill("1000");
  await expect(page.getByText("Your wallet receives 1,000 PLAY.")).toBeVisible();
  await expect(page.getByText("The supply is fixed at 1,000 PLAY.")).toBeVisible();

  await page.getByRole("button", { name: "Connect MetaMask" }).click();
  await expect(page.getByText("Network: QMS Testnet")).toBeVisible();
  await expect(page.getByText("0xf39F…2266")).toBeVisible();

  const added = await page.evaluate(() => {
    return (
      window as Window & {
        __noobAddedChain?: {
          chainId: string;
          chainName: string;
          nativeCurrency: { symbol: string; decimals: number };
          rpcUrls: string[];
          blockExplorerUrls?: string[];
        };
      }
    ).__noobAddedChain;
  });
  expect(added?.chainId.toLowerCase()).toBe("0x4c18");
  expect(added?.chainName).toBe("QMS Testnet");
  expect(added?.nativeCurrency.symbol).toBe("QMS");
  expect(added?.nativeCurrency.decimals).toBe(18);
  expect(added?.rpcUrls[0]).toBe("http://127.0.0.1:8545");
  expect(added?.blockExplorerUrls?.[0]).toBe("https://testnet.qmsscan.io");

  await page.getByRole("button", { name: "Sign and deploy" }).click();
  await expect(page.getByRole("heading", { name: "Your token is on QMS Testnet." })).toBeVisible();
  const address = (await page.getByTestId("contract-address").innerText()).trim();
  expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  await expect(page.getByRole("link", { name: "View on QMSScan" })).toHaveAttribute(
    "href",
    `https://testnet.qmsscan.io/address/${address}`,
  );
  await expect(page.getByText("Playwright Token (PLAY), with a supply of 1,000.")).toBeVisible();

  await page.getByRole("button", { name: "Add PLAY to wallet" }).click();
  await expect(page.getByRole("button", { name: "Added to your wallet" })).toBeVisible();
  const watched = await page.evaluate(() => {
    return (
      window as Window & {
        __noobWatched?: { type: string; options: { address: string; symbol: string; decimals: number } };
      }
    ).__noobWatched;
  });
  expect(watched?.type).toBe("ERC20");
  expect(watched?.options.address.toLowerCase()).toBe(address.toLowerCase());
  expect(watched?.options.symbol).toBe("PLAY");
  expect(watched?.options.decimals).toBe(18);

  await page.setViewportSize({ width: 390, height: 900 });
  await noHorizontalOverflow(page);
  await page.screenshot({ path: "/tmp/noob-success-mobile.png", fullPage: true });

  await page.getByRole("button", { name: "Deploy another" }).click();
  await expect(page.getByRole("button", { name: "Sign and deploy" })).toBeVisible();
});

test("deploys a mintable and burnable token that enforces the owner", async ({ page }) => {
  await page.addInitScript(installMockWallet);
  await page.goto("/");
  await page.getByRole("textbox", { name: "Name" }).fill("Open Token");
  await page.getByRole("textbox", { name: "Symbol" }).fill("OPEN");
  await page.getByRole("textbox", { name: "Total supply" }).fill("1000");
  await page.getByRole("checkbox", { name: /create more tokens later/ }).check();
  await page.getByRole("checkbox", { name: /destroy their own tokens/ }).check();
  await expect(page.getByTestId("summary")).toContainText("There is no supply cap.");
  await expect(page.getByTestId("summary")).toContainText("A holder can destroy OPEN");

  await page.getByRole("button", { name: "Connect MetaMask" }).click();
  await expect(page.getByText("Network: QMS Testnet")).toBeVisible();
  await page.getByRole("button", { name: "Sign and deploy" }).click();
  await expect(page.getByRole("heading", { name: "Your token is on QMS Testnet." })).toBeVisible();
  const address = (await page.getByTestId("contract-address").innerText()).trim() as `0x${string}`;

  const publicClient = createPublicClient({ chain: anvil, transport: http(anvil.rpcUrls.default.http[0]) });
  const wallet = createWalletClient({
    account: deployer,
    chain: anvil,
    transport: http(anvil.rpcUrls.default.http[0]),
  });
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
  const minted = await wallet.writeContract({
    address,
    abi: mintAbi,
    functionName: "mint",
    args: [deployer.address, parseUnits("2", 18)],
  });
  await publicClient.waitForTransactionReceipt({ hash: minted });
  const supply = await publicClient.readContract({
    address,
    abi: [{ type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }] as const,
    functionName: "totalSupply",
  });
  expect(supply).toBe(parseUnits("1002", 18));

  const strangerWallet = createWalletClient({
    account: stranger,
    chain: anvil,
    transport: http(anvil.rpcUrls.default.http[0]),
  });
  await expect(
    strangerWallet.writeContract({
      address,
      abi: mintAbi,
      functionName: "mint",
      args: [stranger.address, 1n],
    }),
  ).rejects.toThrow();
});
