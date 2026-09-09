import styles from "./under-construction.module.css";

/**
 * Public placeholder shown instead of the app while `NEXT_PUBLIC_COMMUNITIES_ENABLED`
 * is `false` (see `src/lib/app-gate.ts`). Deliberately framework-free: no Chakra, no
 * wallet or chain providers — a hidden deployment must not open RPC/WebSocket
 * connections or expose any app UI.
 */
export function UnderConstruction() {
    return (
        <main className={styles.page}>
            <div className={styles.badge}>
                <div className={styles.hex}>🐝</div>
            </div>

            <p className={styles.kicker}>BeeZee Blockchain</p>
            <h1 className={styles.title}>Communities</h1>
            <p className={styles.sub}>
                Discover, join, and grow communities on the BeeZee blockchain. A place
                for the hive to gather — we&apos;re building it now, check back soon.
            </p>

            <div className={styles.dots} aria-hidden>
                <span/>
                <span/>
                <span/>
            </div>

            <p className={styles.foot}>
                Under construction · <a href="https://getbze.com">getbze.com</a>
            </p>
        </main>
    );
}
