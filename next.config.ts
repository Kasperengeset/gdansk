import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (lokal database) laster WASM-filer fra node_modules og må ikke bundles.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
