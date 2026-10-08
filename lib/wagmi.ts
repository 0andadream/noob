import { createConfig, http, injected } from "wagmi";
import { qmsRpcUrl, qmsTestnet } from "./chain";

export const config = createConfig({
  chains: [qmsTestnet],
  connectors: [injected({ shimDisconnect: true })],
  multiInjectedProviderDiscovery: true,
  pollingInterval: 8_000,
  ssr: true,
  transports: {
    [qmsTestnet.id]: http(qmsRpcUrl, { batch: false, retryCount: 2, timeout: 20_000 }),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
