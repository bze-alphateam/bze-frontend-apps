import {readFileSync} from "node:fs";
import {join} from "node:path";

const read = (...parts: string[]) => JSON.parse(readFileSync(join(__dirname, "..", "fixtures", ...parts), "utf8")) as {body: Record<string, unknown>};

export type ScanDaoItem = Record<string, unknown> & {id: number; name: string};

/** The four DAOs of the home page fixtures as Scan lists them, newest first (4 Stakers club … 1 Beekeepers). */
export const fourScanDaos = (): ScanDaoItem[] => read("scan", "daos.page-1.json").body.items as ScanDaoItem[];

/** The same four in the chain's shape, newest first (the Scan-down fallback). */
export const fourChainDaos = (): Record<string, unknown>[] => read("lcd", "dao.daos.fallback.json").body.daos as Record<string, unknown>[];

export const SCAN_DAOS = "/api/scan/daos";
