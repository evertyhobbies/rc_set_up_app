/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/api/setup/migrate": ["./src/db/migrations/**"],
  },
};

export default nextConfig;
