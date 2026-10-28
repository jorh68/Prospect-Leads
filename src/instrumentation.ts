/** Starts the background job worker once per Node.js server process. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.DISABLE_WORKER === "1") return;
  const { startWorker } = await import("./lib/jobs/worker");
  await startWorker();
}
