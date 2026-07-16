import { beforeEach, describe, expect, it } from "vitest";

import { createTestDriver } from "./sqlJsDriver";
import type { SqlDriver } from "./driver";

let driver: SqlDriver;

beforeEach(async () => {
  driver = await createTestDriver();
  await driver.execBatch("CREATE TABLE t (a TEXT, b INTEGER, q REAL)");
});

describe("sqlJsDriver", () => {
  it("round-trips typed values through parameter binding", async () => {
    await driver.exec("INSERT INTO t (a, b, q) VALUES (?, ?, ?)", ["x", 1, 2.5]);
    const rows = await driver.exec("SELECT a, b, q FROM t");
    expect(rows).toEqual([{ a: "x", b: 1, q: 2.5 }]);
  });

  it("binds and returns NULL", async () => {
    await driver.exec("INSERT INTO t (a, b, q) VALUES (?, ?, ?)", [null, 7, null]);
    const rows = await driver.exec("SELECT a, b, q FROM t WHERE b = ?", [7]);
    expect(rows).toEqual([{ a: null, b: 7, q: null }]);
  });

  it("returns an empty array for write statements", async () => {
    const rows = await driver.exec("INSERT INTO t (a, b, q) VALUES (?, ?, ?)", ["y", 2, 0]);
    expect(rows).toEqual([]);
  });

  it("commits transactions", async () => {
    await driver.transaction(async () => {
      await driver.exec("INSERT INTO t (a, b, q) VALUES (?, ?, ?)", ["tx", 3, 1]);
    });
    const rows = await driver.exec("SELECT a FROM t WHERE b = ?", [3]);
    expect(rows).toHaveLength(1);
  });

  it("rolls back when the transaction body throws", async () => {
    await expect(
      driver.transaction(async () => {
        await driver.exec("INSERT INTO t (a, b, q) VALUES (?, ?, ?)", ["boom", 4, 1]);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const rows = await driver.exec("SELECT a FROM t WHERE b = ?", [4]);
    expect(rows).toHaveLength(0);
  });

  it("rejects nested transactions — repos never nest them", async () => {
    await expect(
      driver.transaction(async () => {
        await driver.transaction(async () => undefined);
      }),
    ).rejects.toThrow(/nested/i);
  });

  it("propagates SQL errors with the failing statement's message", async () => {
    await expect(driver.exec("SELECT nope FROM missing_table")).rejects.toThrow(/missing_table/);
  });
});
