/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@beacon/core', '@beacon/ui', '@beacon/analytics'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
};

export default nextConfig;
