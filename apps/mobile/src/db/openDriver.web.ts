import { Asset } from "expo-asset";
import initSqlJs from "sql.js";
import wasmAsset from "sql.js/dist/sql-wasm.wasm";

import type { SqlDriver } from "./driver";
import { createSqlJsDriver } from "./sqlJsDriver";

/**
 * Web-preview driver: sql.js over the Metro-bundled wasm. In-memory only —
 * the browser pane is a verification surface, not a storage target; devices
 * use the persistent expo-sqlite driver in openDriver.ts.
 */
export async function openAppDriver(): Promise<SqlDriver> {
  const asset = Asset.fromModule(wasmAsset);
  const SQL = await initSqlJs({ locateFile: () => asset.uri });
  return createSqlJsDriver(new SQL.Database());
}
