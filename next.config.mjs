/** @type {import('next').NextConfig} */
const nextConfig = {
  // Node-driver packages must stay external to the server bundle
  // (pg for Vercel Postgres / Neon; node:sqlite is built into Node ≥ 22).
  serverExternalPackages: ["pg"],
};

export default nextConfig;
