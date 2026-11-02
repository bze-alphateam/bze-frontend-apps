import { defineConfig } from 'tsup'

export default defineConfig([{
  entry: ['src/index.ts', 'src/server.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  // dist is emptied by the build script: with two configs running side by side, a clean here
  // could delete the worker bundle the other one just wrote
  clean: false,
  splitting: false,
  sourcemap: true,
  external: [
    'react',
    'react-dom',
    '@bze/bzejs',
    '@chakra-ui/react',
    '@interchain-kit/core',
    '@interchain-kit/react',
    '@interchainjs/cosmos',
    '@interchainjs/encoding',
    '@chain-registry/types',
    '@chain-registry/utils',
    'bignumber.js',
    'chain-registry',
    'next-themes',
    'react-icons',
    'wagmi',
    'wagmi/chains',
    'wagmi/connectors',
    'viem',
    '@wagmi/core',
    '@wagmi/connectors',
    '@tanstack/react-query',
  ],
},
  {
    // SharedWorker entry (BFE-291): one self-contained script, served by every app as
    // /chain-feed-worker.js (see scripts/copy-chain-feed-worker.mjs)
    entry: { 'chain-feed-worker': 'src/workers/chain-feed.worker.ts' },
    format: ['iife'],
    platform: 'browser',
    dts: false,
    clean: false,
    minify: true,
    splitting: false,
    sourcemap: false,
  },
])
