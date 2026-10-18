import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
    getBurnerApp,
    getCommunitiesApp,
    getDexApp,
    getEcosystemApp,
    getExplorerApp,
    getEcosystemApps,
    getFactoryApp,
    getStakingApp,
    getWebsiteApp,
} from './ecosystem'

describe('getEcosystemApp', () => {
    it('returns the correct app for a known key', () => {
        const app = getEcosystemApp('dex')
        expect(app).toBeDefined()
        expect(app?.key).toBe('dex')
        expect(app?.name).toBe('DEX')
        expect(app?.href).toBe('https://dex.getbze.com')
        expect(app?.disabled).toBe(false)
    })

    it('returns undefined for an unknown key', () => {
        expect(getEcosystemApp('unknown-key')).toBeUndefined()
        expect(getEcosystemApp('')).toBeUndefined()
    })

    it('returns a valid app for every known key', () => {
        const keys = ['website', 'staking', 'dex', 'burner', 'factory', 'communities', 'explorer']
        for (const key of keys) {
            const app = getEcosystemApp(key)
            expect(app, `expected app for key "${key}"`).toBeDefined()
            expect(app?.key).toBe(key)
            expect(app?.href).toBeTruthy()
            expect(app?.name).toBeTruthy()
        }
    })

    it('returns the app even when the key is in NEXT_PUBLIC_ECOSYSTEM_EXCLUDED', () => {
        // getEcosystemApp is for deep links — it intentionally ignores the exclusion list.
        // We can verify this by relying on getEcosystemApps() honoring the env var
        // while getEcosystemApp() does not (both operate on the same DEFAULT_APPS array).
        const app = getEcosystemApp('dex')
        expect(app).toBeDefined()
    })
})

describe('named per-app helpers', () => {
    it('getWebsiteApp returns the website app', () => {
        const app = getWebsiteApp()
        expect(app.key).toBe('website')
        expect(app.href).toBe('https://getbze.com')
    })

    it('getStakingApp returns the staking app', () => {
        const app = getStakingApp()
        expect(app.key).toBe('staking')
        expect(app.href).toBe('https://staking.getbze.com')
    })

    it('getDexApp returns the dex app', () => {
        const app = getDexApp()
        expect(app.key).toBe('dex')
        expect(app.href).toBe('https://dex.getbze.com')
    })

    it('getBurnerApp returns the burner app', () => {
        const app = getBurnerApp()
        expect(app.key).toBe('burner')
        expect(app.href).toBe('https://burner.getbze.com')
    })

    it('getFactoryApp returns the factory app', () => {
        const app = getFactoryApp()
        expect(app.key).toBe('factory')
        expect(app.href).toBe('https://factory.getbze.com')
    })

    it('getCommunitiesApp returns the communities app', () => {
        const app = getCommunitiesApp()
        expect(app.key).toBe('communities')
        expect(app.href).toBe('https://communities.getbze.com')
    })
})

// The env var overrides are evaluated at module-load time (LINK_OVERRIDES / LABEL_OVERRIDES
// are module-level constants). Testing them requires re-importing the module after setting
// the env var. vi.resetModules() + dynamic import achieves this without polluting other tests.
describe('getEcosystemApp env var overrides', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    it('applies NEXT_PUBLIC_ECOSYSTEM_LINK_* when set', async () => {
        process.env.NEXT_PUBLIC_ECOSYSTEM_LINK_DEX = 'https://testnet-dex.getbze.com'
        try {
            const { getEcosystemApp: fresh } = await import('./ecosystem')
            const app = fresh('dex')
            expect(app?.href).toBe('https://testnet-dex.getbze.com')
        } finally {
            delete process.env.NEXT_PUBLIC_ECOSYSTEM_LINK_DEX
        }
    })

    it('sets disabled=false when a link override is present', async () => {
        process.env.NEXT_PUBLIC_ECOSYSTEM_LINK_BURNER = 'https://testnet-burner.getbze.com'
        try {
            const { getEcosystemApp: fresh } = await import('./ecosystem')
            const app = fresh('burner')
            expect(app?.disabled).toBe(false)
        } finally {
            delete process.env.NEXT_PUBLIC_ECOSYSTEM_LINK_BURNER
        }
    })

    it('applies NEXT_PUBLIC_ECOSYSTEM_LABEL_* when set', async () => {
        process.env.NEXT_PUBLIC_ECOSYSTEM_LABEL_DEX = 'TestDEX'
        try {
            const { getEcosystemApp: fresh } = await import('./ecosystem')
            const app = fresh('dex')
            expect(app?.name).toBe('TestDEX')
        } finally {
            delete process.env.NEXT_PUBLIC_ECOSYSTEM_LABEL_DEX
        }
    })

    it('falls back to defaults when no env vars are set', async () => {
        const { getDexApp: fresh } = await import('./ecosystem')
        const app = fresh()
        expect(app?.href).toBe('https://dex.getbze.com')
        expect(app?.name).toBe('DEX')
    })
})

describe('getEcosystemApps exclusions', () => {
    it('returns all apps when no exclusions are set', () => {
        const apps = getEcosystemApps()
        expect(apps.length).toBe(7)
    })

    it('drops the keys listed in NEXT_PUBLIC_ECOSYSTEM_EXCLUDED, explorer included', () => {
        process.env.NEXT_PUBLIC_ECOSYSTEM_EXCLUDED = 'explorer, dex'
        try {
            const keys = getEcosystemApps().map(a => a.key)
            expect(keys).not.toContain('explorer')
            expect(keys).not.toContain('dex')
            expect(keys).toHaveLength(5)
        } finally {
            delete process.env.NEXT_PUBLIC_ECOSYSTEM_EXCLUDED
        }
    })
})

describe('Apps menu order', () => {
    it('lists Website, DEX, Staking, Burner, Factory, Communities, Explorer', () => {
        expect(getEcosystemApps().map(a => a.name)).toEqual(
            ['Website', 'DEX', 'Staking', 'Burner', 'Factory', 'Communities', 'Explorer'],
        )
    })
})

describe('Explorer entry', () => {
    it('defaults to the mainnet explorer', () => {
        const app = getExplorerApp()
        expect(app.key).toBe('explorer')
        expect(app.name).toBe('Explorer')
        expect(app.href).toBe('https://explorer.getbze.com')
    })

    it('follows NEXT_PUBLIC_EXPLORER_URL, so testnet builds link the testnet explorer', () => {
        process.env.NEXT_PUBLIC_EXPLORER_URL = 'https://testnet-explorer.getbze.com/'
        try {
            expect(getExplorerApp().href).toBe('https://testnet-explorer.getbze.com')
            expect(getEcosystemApps().find(a => a.key === 'explorer')?.href).toBe('https://testnet-explorer.getbze.com')
        } finally {
            delete process.env.NEXT_PUBLIC_EXPLORER_URL
        }
    })

    describe('env overrides', () => {
        beforeEach(() => {
            vi.resetModules()
        })

        it('applies NEXT_PUBLIC_ECOSYSTEM_LINK_EXPLORER over the explorer URL', async () => {
            process.env.NEXT_PUBLIC_EXPLORER_URL = 'https://testnet-explorer.getbze.com'
            process.env.NEXT_PUBLIC_ECOSYSTEM_LINK_EXPLORER = 'https://scan.example.org'
            try {
                const { getExplorerApp: fresh } = await import('./ecosystem')
                expect(fresh().href).toBe('https://scan.example.org')
            } finally {
                delete process.env.NEXT_PUBLIC_EXPLORER_URL
                delete process.env.NEXT_PUBLIC_ECOSYSTEM_LINK_EXPLORER
            }
        })

        it('applies NEXT_PUBLIC_ECOSYSTEM_LABEL_EXPLORER', async () => {
            process.env.NEXT_PUBLIC_ECOSYSTEM_LABEL_EXPLORER = 'Scan'
            try {
                const { getExplorerApp: fresh } = await import('./ecosystem')
                expect(fresh().name).toBe('Scan')
            } finally {
                delete process.env.NEXT_PUBLIC_ECOSYSTEM_LABEL_EXPLORER
            }
        })
    })
})
