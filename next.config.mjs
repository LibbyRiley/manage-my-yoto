/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.podcastindex.org" },
      { protocol: "https", hostname: "**.yotoplay.com" },
    ],
  },
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
