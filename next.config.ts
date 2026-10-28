import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Data is per-request (SQLite via Prisma); pages opt into dynamic rendering
  // from the root layout instead of using Cache Components.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
