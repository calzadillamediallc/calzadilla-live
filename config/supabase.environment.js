(() => {
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const requestedEnvironment = new URLSearchParams(
    window.location.search
  ).get("supabase");
  const useStaging =
    window.location.protocol === "file:" ||
    localHosts.has(window.location.hostname) ||
    requestedEnvironment === "staging";

  window.CALZADILLA_SUPABASE_ENVIRONMENT = useStaging
    ? "staging"
    : "production";

  if (useStaging && !window.CALZADILLA_STAGING_SUPABASE_CONFIG) {
    document.write(
      '<script src="config/supabase.staging.generated.js"></script>'
    );
  }
})();
