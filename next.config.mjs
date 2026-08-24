import nextra from 'nextra'

const withNextra = nextra({
  // Use content directory convention for MDX files
  // Files in /content will be served at the root

  // Keep MDX image paths as plain strings instead of webpack static imports.
  // With staticImage enabled, Nextra turns every `![](/images/...)` into a static
  // import, which makes it render through next/image — that burns Vercel Image
  // Optimization transformations and duplicates ~485MB of images into
  // .next/static/media. Images are served straight from /public instead.
  staticImage: false,
})

// Vercel serves everything in /public with `max-age=0, must-revalidate` because
// the filenames are not content-hashed, so the edge revalidates against the
// origin constantly — that is what drives Fast Origin Transfer. Docs assets and
// pages only change on deploy, and a deploy purges the edge cache, so the edge
// can hold them for a long time. Browsers keep a shorter TTL so a replaced file
// under the same name still shows up within the day.
const EDGE_CACHED_ASSET = 'public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400'
const EDGE_CACHED_PAGE = 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800'

export default withNextra({
  reactStrictMode: true,
  outputFileTracingExcludes: {
    '*': ['public/**/*'],
  },
  async headers() {
    return [
      { source: '/images/:path*', headers: [{ key: 'Cache-Control', value: EDGE_CACHED_ASSET }] },
      { source: '/models/:path*', headers: [{ key: 'Cache-Control', value: EDGE_CACHED_ASSET }] },
      {
        // Docs pages and their RSC payloads. Serving these from the edge keeps
        // sidebar link prefetches from hitting the prerender cache, which is
        // what every ISR read is. Excludes the API, the admin UI, the CMS and
        // the asset folders handled above.
        source: '/((?!api/|admin|keystatic|images/|models/|_next/).*)',
        headers: [{ key: 'Cache-Control', value: EDGE_CACHED_PAGE }],
      },
    ]
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Avoid noisy filesystem-cache serialization warnings during local development.
      config.cache = { type: 'memory' }
    }

    return config
  },
})
