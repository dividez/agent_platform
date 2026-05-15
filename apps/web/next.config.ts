import type { NextConfig } from "next";

function normalizeBasePath(value: string | undefined): string | undefined {
  if (!value || value === "/") {
    return undefined;
  }

  return `/${value.replace(/^\/+|\/+$/g, "")}`;
}

const basePath = normalizeBasePath(
  process.env.NEXT_PUBLIC_WEB_BASE_PATH ?? process.env.PUBLIC_BASE_PATH,
);

const nextConfig: NextConfig = {
  basePath,
  assetPrefix: basePath,
  typedRoutes: true,
};

export default nextConfig;
