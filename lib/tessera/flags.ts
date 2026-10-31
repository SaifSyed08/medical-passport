/** Feature flags. Env vars override the in-code defaults if the host provides them. */
type FlagEnv = { WALLET_ENABLED?: string; TESSERA_PRESENTER?: string };

export function flags(env: FlagEnv = {}) {
  return {
    walletEnabled: env.WALLET_ENABLED === "true",
    // Presenter tools are on by default because this is a demo build.
    presenterEnabled: env.TESSERA_PRESENTER !== "false",
  };
}
