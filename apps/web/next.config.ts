import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ["@riftcore/tournament-core"],
};

export default nextConfig;
