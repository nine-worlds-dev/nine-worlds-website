/** @type {import("next").NextConfig} */
const nextConfig = {
  output: 'export',
  eslint: {
    // تعطيل ESLint أثناء البناء
    ignoreDuringBuilds: true,
  },
  typescript: {
    // تعطيل فحص TypeScript أثناء البناء
    ignoreBuildErrors: true,
  },

  trailingSlash: true,
  images: {
    unoptimized: true
  }
};

module.exports = nextConfig;


