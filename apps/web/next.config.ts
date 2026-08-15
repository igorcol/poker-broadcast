import type { NextConfig } from "next"

const config: NextConfig = {
  transpilePackages: ["@poker-broadcast/core"],
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = { ".ts": [".ts", ".tsx"], ".js": [".js", ".ts", ".tsx"] }
    return webpackConfig
  },
}

export default config