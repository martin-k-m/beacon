/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@beacon/shared',
    '@beacon/github',
    '@beacon/ai',
    '@beacon/analytics',
    '@beacon/ui',
  ],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
};

export default nextConfig;
