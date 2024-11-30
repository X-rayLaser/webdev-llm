/** @type {import('next').NextConfig} */
const nextConfig = {
    basePath: '/app',
    experimental: {
        serverActions: {
          bodySizeLimit: '3mb',
        },
    },
};

export default nextConfig;
