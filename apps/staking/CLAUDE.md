# BZE Staking (staking.getbze.com)

## Patches

`patches/@interchain-kit+store+0.9.1.patch` — fixes `@interchain-kit/store` passing `{}` instead of `undefined` as signOptions in `ChainWalletStore.getOfflineSigner()`, which caused Keplr to override custom fee denoms. PR submitted upstream: https://github.com/hyperweb-io/interchain-kit/pull/XXX. Remove this patch once the fix is released upstream.
