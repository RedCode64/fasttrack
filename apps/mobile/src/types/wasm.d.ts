/** Metro bundles .wasm files as assets (see metro.config.js); imports resolve
 * to an asset module id consumable by expo-asset. */
declare module "*.wasm" {
  const assetId: number;
  export default assetId;
}
