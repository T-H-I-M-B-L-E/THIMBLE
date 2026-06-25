import withPWA from "next-pwa"

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-7d3bae49e1ed4b6a85580cb36d1f0165.r2.dev",
      },
      {
        protocol: "https",
        hostname: "ui-avatars.com",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },
}

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
})(nextConfig)
