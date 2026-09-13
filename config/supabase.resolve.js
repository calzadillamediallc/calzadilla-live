(() => {
  const environment = window.CALZADILLA_SUPABASE_ENVIRONMENT;
  const selectedConfig =
    environment === "staging"
      ? window.CALZADILLA_STAGING_SUPABASE_CONFIG
      : window.CALZADILLA_PRODUCTION_SUPABASE_CONFIG;

  if (!selectedConfig?.url || !selectedConfig?.anonKey) {
    throw new Error(
      environment === "staging"
        ? "Missing generated staging Supabase configuration. Run pnpm run config:staging."
        : "Missing production Supabase configuration."
    );
  }

  window.CALZADILLA_SUPABASE_CONFIG = Object.freeze({
    url: selectedConfig.url,
    anonKey: selectedConfig.anonKey
  });
})();
