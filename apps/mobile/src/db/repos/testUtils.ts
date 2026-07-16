import type { DbCtx } from "../driver";
import { migrate } from "../migrations";
import { createTestDriver } from "../sqlJsDriver";

/** Deterministic RFC-4122-shaped ids: 00000000-0000-4000-8000-000000000001, … */
export function createSeqIdGen(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  };
}

export interface TestCtx {
  readonly ctx: DbCtx;
  /** Moves the injected clock; every repo write stamps this instant. */
  readonly setNow: (iso: string) => void;
}

/** Fresh migrated in-memory database with a controllable clock and id sequence. */
export async function createTestCtx(
  startIso = "2026-07-16T12:00:00.000Z",
): Promise<TestCtx> {
  const driver = await createTestDriver();
  await migrate(driver);
  let current = startIso;
  return {
    ctx: { driver, newId: createSeqIdGen(), now: () => current },
    setNow: (iso: string) => {
      current = iso;
    },
  };
}
