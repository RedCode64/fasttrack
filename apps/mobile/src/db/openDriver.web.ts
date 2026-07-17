import { Asset } from "expo-asset";
import initSqlJs from "sql.js";
import wasmAsset from "sql.js/dist/sql-wasm.wasm";

import type { SqlDriver } from "./driver";
import { createSqlJsDriver } from "./sqlJsDriver";
import { loadDbImage, saveDbImage } from "./webPersistence";

/**
 * Web-preview driver: sql.js over the Metro-bundled wasm, made durable by
 * snapshotting the database into IndexedDB (see webPersistence). Restoring the
 * snapshot on open is what keeps a returning user's business and jobs around,
 * so onboarding only ever runs once. Devices use the persistent expo-sqlite
 * driver in openDriver.ts.
 */
export async function openAppDriver(): Promise<SqlDriver> {
  const asset = Asset.fromModule(wasmAsset);
  const SQL = await initSqlJs({ locateFile: () => asset.uri });
  const saved = await loadDbImage();
  const db = saved ? new SQL.Database(saved) : new SQL.Database();
  return createSqlJsDriver(db, async () => {
    await saveDbImage(db.export());
  });
}
