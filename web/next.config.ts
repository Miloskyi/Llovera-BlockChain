import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite compilar una copia de producción sin chocar con `next dev` (que usa .next).
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
