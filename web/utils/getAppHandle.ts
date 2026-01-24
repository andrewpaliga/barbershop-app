/**
 * Gets the app handle based on the current environment.
 * The app handle is used in Shopify's plan selection URLs.
 */
export function getAppHandle(environment?: string): string {
  // Check environment from various sources
  let env = environment;
  
  // If no environment provided, try to detect from window location
  if (!env && typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname.includes("--development") || hostname.includes("development")) {
      env = "development";
    } else {
      env = "production";
    }
  }

  // Default to production if still unknown
  env = env || "production";

  // Return appropriate handle based on environment
  if (env === "development") {
    return "simplybook-dev";
  }
  
  return "simplybook";
}

