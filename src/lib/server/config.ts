export const demoMode = () =>
  process.env.DEMO_MODE === "true" ||
  (process.env.NODE_ENV !== "production" && !process.env.DATABASE_URL);
export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
