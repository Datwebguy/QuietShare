import { WEB3AUTH_NETWORK } from "@web3auth/auth";
import { CHAIN_NAMESPACES, type CustomChainConfig } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { Web3Auth } from "@web3auth/modal";
import { COSTON2_CHAIN_ID_HEX, COSTON2_EXPLORER_URL, COSTON2_RPC_URL } from "./chain";

/**
 * Web3Auth is Flare's official social-login partner (Google/Apple → embedded
 * wallet, no seed phrase — see the Flare Foundation news post "Flare Partners
 * with Web3Auth to Enable Seamless Social Logins for Web3 Apps"). This uses the
 * classic @web3auth/modal v9 imperative API (new Web3Auth → initModal → connect),
 * confirmed against the installed package's own type declarations.
 *
 * Create a project at https://dashboard.web3auth.io and paste its Client ID into
 * NEXT_PUBLIC_WEB3AUTH_CLIENT_ID. Unlike some newer SDK versions, this classic
 * API takes the chain config directly in code (below), not via the dashboard.
 */
const chainConfig: CustomChainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: COSTON2_CHAIN_ID_HEX,
  rpcTarget: COSTON2_RPC_URL,
  displayName: "Flare Testnet Coston2",
  blockExplorerUrl: COSTON2_EXPLORER_URL,
  ticker: "C2FLR",
  tickerName: "Coston2 Flare"
};

let initPromise: Promise<Web3Auth> | null = null;

/** Lazily creates and initializes a single Web3Auth instance for the app's lifetime. */
export function getWeb3Auth(): Promise<Web3Auth> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const privateKeyProvider = new EthereumPrivateKeyProvider({ config: { chainConfig } });

    const web3auth = new Web3Auth({
      clientId: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID ?? "",
      web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
      privateKeyProvider
    });

    await web3auth.initModal();
    return web3auth;
  })();

  return initPromise;
}
