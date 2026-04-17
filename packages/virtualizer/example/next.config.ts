import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: false,
  transpilePackages: ['@zenbu/virtualizer'],
}

export default nextConfig
