import type { NextConfig } from "next";
import path from "path";

const rootDir = path.join(__dirname);

const nextConfig: NextConfig = {
  outputFileTracingRoot: rootDir,
};

export default nextConfig;
