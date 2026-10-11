import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The dev badge covers the sidebar logo and ignores `position` in this version.
  // Compile and runtime errors are still shown with it off.
  devIndicators: false,
  experimental: { optimizePackageImports: ["@phosphor-icons/react"] },
  partialPrefetching: true,
  // The news queue grew into the Research page.
  async redirects() {
    return [{ source: "/news", destination: "/research", permanent: false }];
  },
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
