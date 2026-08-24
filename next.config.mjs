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

export default withNextra({
  reactStrictMode: true,
  outputFileTracingExcludes: {
    '*': ['public/**/*'],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Avoid noisy filesystem-cache serialization warnings during local development.
      config.cache = { type: 'memory' }
    }

    return config
  },
})
