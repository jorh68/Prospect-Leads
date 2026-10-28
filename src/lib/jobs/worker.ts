import "server-only";
import type { Job } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { errorMessage } from "../http";
import { JOB_TYPES, type JobType } from "../domain/constants";
import { handlers, typeConcurrency } from "./handlers";

/**
 * In-process worker for the persistent Job queue. Started once per server
 * process from src/instrumentation.ts. Jobs survive restarts: anything left
 * "running" by a crash is put back in the queue on start.
 */
interface WorkerState {
  started: boolean;
  ticking: boolean;
  again: boolean;
  running: Map<string, JobType>;
  timer?: ReturnType<typeof setInterval>;
}

declare global {
  var __prospectWorker: WorkerState | undefined;
}

const state: WorkerState = (globalThis.__prospectWorker ??= {
  started: false,
  ticking: false,
  again: false,
  running: new Map(),
});

const POLL_MS = 3000;

export async function startWorker() {
  if (state.started) return;
  state.started = true;

  const recovered = await db.job.updateMany({
    where: { status: "running" },
    data: { status: "queued", startedAt: null },
  });
  if (recovered.count > 0) console.info(`[worker] ${recovered.count} trabajo(s) reanudados tras reinicio`);

  globalThis.__prospectWorkerKick = () => void tick();
  state.timer = setInterval(() => void tick(), POLL_MS);
  state.timer.unref?.();
  void tick();
}

async function tick() {
  if (state.ticking) {
    state.again = true;
    return;
  }
  state.ticking = true;
  try {
    do {
      state.again = false;
      await fillSlots();
    } while (state.again);
  } catch (e) {
    console.error("[worker] error al leer la cola:", e);
  } finally {
    state.ticking = false;
  }
}

async function fillSlots() {
  const total = env().JOB_CONCURRENCY;
  for (const type of JOB_TYPES) {
    const runningOfType = [...state.running.values()].filter((t) => t === type).length;
    const free = Math.min(typeConcurrency[type] - runningOfType, total - state.running.size);
    if (free <= 0) continue;

    const candidates = await db.job.findMany({
      where: { status: "queued", type },
      orderBy: { createdAt: "asc" },
      take: free,
    });
    for (const job of candidates) {
      // Atomic claim: only one tick can move a job from queued to running.
      const claimed = await db.job.updateMany({
        where: { id: job.id, status: "queued" },
        data: { status: "running", startedAt: new Date(), attempts: { increment: 1 } },
      });
      if (claimed.count === 0) continue;
      state.running.set(job.id, type);
      void execute(job);
    }
  }
}

async function execute(job: Job) {
  const started = Date.now();
  try {
    await handlers[job.type as JobType](job);
    await db.job.update({
      where: { id: job.id },
      data: { status: "completed", finishedAt: new Date(), error: null },
    });
    console.info(`[worker] ${job.type} ${job.id} completado en ${Date.now() - started} ms`);
  } catch (e) {
    const message = errorMessage(e);
    console.error(`[worker] ${job.type} ${job.id} falló: ${message}`);
    await db.job
      .update({ where: { id: job.id }, data: { status: "failed", finishedAt: new Date(), error: message } })
      .catch((err) => console.error("[worker] no se pudo marcar el fallo:", err));
  } finally {
    state.running.delete(job.id);
    void tick();
  }
}
