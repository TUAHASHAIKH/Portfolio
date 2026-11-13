/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  images: {
    unoptimized: true,
  },
  async headers() {
    // These URLs are not content-hashed: use a bounded lifetime, not immutable.
    return ['/scene/:path*', '/audio/:path*', '/fonts/:path*', '/images/:path*'].map(source => ({
      source,
      headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' }],
    }))
  },
}

export default nextConfig
