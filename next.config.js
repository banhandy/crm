/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    Supabase_url: process.env.Supabase_url,
    Supabase_Key: process.env.Supabase_Key,
  }
};

module.exports = nextConfig;
