import "server-only";

export function isCrmDemoMode() {
  return process.env.NODE_ENV !== "production" && process.env.VANCE_ENABLE_DEMO_DATA === "true";
}
