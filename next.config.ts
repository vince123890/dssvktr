import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // v5.0 — signed quotations, PO and transfer proofs are uploaded through
    // server actions (up to 10 MB each, see src/lib/files.ts); the default
    // action body limit is 1 MB.
    serverActions: { bodySizeLimit: "11mb" },
  },
};

export default nextConfig;
