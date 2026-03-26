import nextra from 'nextra'

const withNextra = nextra({
  // Use content directory convention for MDX files
  // Files in /content will be served at the root
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
