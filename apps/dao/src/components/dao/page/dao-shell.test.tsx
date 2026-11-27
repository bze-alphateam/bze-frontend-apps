import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import type {Dao} from "@bze/bze-ui-kit";

const nav = vi.hoisted(() => ({push: vi.fn(), replace: vi.fn()}));
vi.mock("next/navigation", () => ({useRouter: () => ({push: nav.push, replace: nav.replace})}));
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    useToast: () => ({toast: {error: vi.fn()}}),
}));

import {OTHER, THIRD, WALLET} from "@/test/composer-fixtures";
import {pageDao} from "@/test/dao-page-fixtures";
import type {DaoExtras} from "@/hooks/useDaoExtras";
import type {ScanDaoDetail} from "@/lib/dao-types";
import type {DaoTab} from "@/lib/dao-tabs";
import {DaoShell} from "./dao-shell";

const extras = (data: Partial<ScanDaoDetail> | null | undefined = null, over: Partial<DaoExtras> = {}): DaoExtras => ({
    data: data as ScanDaoDetail | null | undefined, loading: false, failed: false, retry: vi.fn(), ...over,
});

function renderShell({dao = pageDao(), active = "overview" as DaoTab, wallet = null as string | null, data = null as Partial<ScanDaoDetail> | null, open = 0, chainDown = false, failed = false} = {}) {
    return render(
        <ChakraProvider value={defaultSystem}>
            <DaoShell
                dao={dao}
                active={active}
                wallet={wallet}
                extras={extras(data, {failed})}
                openProposals={chainDown ? {ok: false} : {ok: true, value: Array.from({length: open}, () => ({}) as never)}}
            >
                <p>content</p>
            </DaoShell>
        </ChakraProvider>,
    );
}

beforeEach(() => {
    nav.push.mockReset();
    nav.replace.mockReset();
});

describe("the DAO header", () => {
    it("back link, one governance pill, the name, the creation day, the address with copy and the Explorer link", () => {
        renderShell();
        expect(screen.getByTestId("dao-back")).toHaveAttribute("href", "/");
        expect(screen.getByTestId("dao-back")).toHaveTextContent("All DAOs");
        expect(screen.getByTestId("dao-type")).toHaveTextContent("Governed by a member list");
        expect(screen.getByRole("heading", {level: 1})).toHaveTextContent("Founders");
        expect(screen.getByTestId("dao-created")).toHaveTextContent("Created on 26 Oct 2026");
        expect(screen.getByTestId("dao-meta")).toHaveTextContent(/DAO address/i);
        expect(screen.getByTestId("dao-address")).toHaveTextContent(pageDao().address);
        expect(screen.getByRole("button", {name: "Copy the DAO address"})).toBeInTheDocument();
        expect(screen.getByTestId("dao-explorer")).toHaveAttribute("href", expect.stringContaining(`/accounts/${pageDao().address}`));
    });

    it("a stakers DAO is governed by stakers", () => {
        renderShell({dao: pageDao({type: "DAO_TYPE_STAKE", members: []})});
        expect(screen.getByTestId("dao-type")).toHaveTextContent("Governed by stakers");
    });

    it("never shows the DAO number, a creator, an avatar, the old tags or a New proposal link", () => {
        renderShell({wallet: WALLET, data: {creator: OTHER, creator_label: {name: "Hive founder", kind: "user"}}});
        const header = screen.getByTestId("dao-header");
        expect(header).not.toHaveTextContent(/DAO #|#4/);
        expect(header).not.toHaveTextContent("Hive founder");
        expect(screen.queryByTestId("dao-creator")).toBeNull();
        expect(header).not.toHaveTextContent(/Governed by its voters|Has an admin|Self-owned|Admin-run|Run by/);
        expect(header.querySelector("img")).toBeNull();
        expect(screen.queryByRole("link", {name: "New proposal"})).toBeNull();
        expect(screen.queryByTestId("dao-open-count")).toBeNull();
    });

    it("the creation day falls back to Scan's, and is left out when neither knows it", () => {
        const {unmount} = renderShell({dao: pageDao({created_at: "0"}), data: {created_time: "2026-11-02T10:00:00Z"}});
        expect(screen.getByTestId("dao-created")).toHaveTextContent("Created on 2 Nov 2026");
        unmount();
        renderShell({dao: pageDao({created_at: "0"})});
        expect(screen.queryByTestId("dao-created")).toBeNull();
    });

    it("Scan down: a retry line, the rest from the chain", () => {
        renderShell({failed: true});
        expect(screen.getByTestId("scan-retry")).toHaveTextContent("could not be loaded from BZE Scan");
        expect(screen.getByTestId("dao-type")).toBeInTheDocument();
    });
});

describe("the description", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("a short one has no View all", () => {
        renderShell();
        expect(screen.getByTestId("dao-description")).toHaveTextContent("The founding members.");
        expect(screen.queryByTestId("dao-description-all")).toBeNull();
    });

    it("a long one is clamped and View all opens 'About <name>' with the full text", async () => {
        const text = `${"Grants for builders. ".repeat(20)}\nSecond paragraph.\nThird.\nFourth.`;
        renderShell({dao: pageDao({description: text})});
        fireEvent.click(screen.getByTestId("dao-description-all"));
        const dialog = await screen.findByTestId("dao-description-dialog");
        expect(dialog).toHaveTextContent("About Founders");
        expect(screen.getByTestId("dao-description-full").textContent).toBe(text);
    });

    /** A browser that measures the clamped text as `scroll` high in a `client` high box. */
    const measuring = (scroll: number, client: number) => {
        class Observer {
            cb: () => void;
            constructor(cb: () => void) {
                this.cb = cb;
            }
            observe() {
                this.cb();
            }
            unobserve() {}
            disconnect() {}
        }
        vi.stubGlobal("ResizeObserver", Observer);
        vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(scroll);
        vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(client);
    };

    it("where the browser measures, a short text that overflows gets View all", async () => {
        measuring(120, 72);
        renderShell();
        await waitFor(() => expect(screen.getByTestId("dao-description-all")).toBeInTheDocument());
    });

    it("where the browser measures, a long text that fits gets no View all (the length rule is only the fallback)", async () => {
        measuring(72, 72);
        const text = "A wide screen fits this. ".repeat(12);
        expect(text.length).toBeGreaterThan(240);
        renderShell({dao: pageDao({description: text})});
        await waitFor(() => expect(screen.queryByTestId("dao-description-all")).toBeNull());
        expect(screen.getByTestId("dao-description")).toHaveTextContent("A wide screen fits this.");
    });
});

describe("the tabs", () => {
    it("Overview, Proposals and History link to their URLs; the active one is marked", () => {
        renderShell({active: "history"});
        expect(screen.getByTestId("dao-tab-overview")).toHaveAttribute("href", "/dao/4");
        expect(screen.getByTestId("dao-tab-proposals")).toHaveAttribute("href", "/dao/4?tab=proposals");
        expect(screen.getByTestId("dao-tab-history")).toHaveAttribute("href", "/dao/4?tab=history");
        expect(screen.getByTestId("dao-tab-history")).toHaveAttribute("aria-current", "page");
        expect(screen.getByTestId("dao-tab-overview")).not.toHaveAttribute("aria-current");
    });

    it("switching tabs on the DAO page replaces the URL, so no history entry is added", () => {
        renderShell();
        fireEvent.click(screen.getByTestId("dao-tab-proposals"));
        expect(nav.replace).toHaveBeenCalledWith("/dao/4?tab=proposals", {scroll: false});
        fireEvent.click(screen.getByTestId("dao-tab-history"));
        expect(nav.replace).toHaveBeenLastCalledWith("/dao/4?tab=history", {scroll: false});
        expect(nav.push).not.toHaveBeenCalled();
    });

    it("the current tab does nothing; a modified click is left to the browser", () => {
        renderShell();
        fireEvent.click(screen.getByTestId("dao-tab-overview"));
        fireEvent.click(screen.getByTestId("dao-tab-history"), {ctrlKey: true});
        expect(nav.replace).not.toHaveBeenCalled();
    });

    it("from the Admin console, a tab goes back to the DAO page with a new history entry", () => {
        renderShell({active: "admin", wallet: THIRD, dao: pageDao({admin: THIRD})});
        fireEvent.click(screen.getByTestId("dao-tab-proposals"));
        expect(nav.push).toHaveBeenCalledWith("/dao/4?tab=proposals");
        expect(screen.getByTestId("admin-console-link")).toHaveAttribute("aria-current", "page");
    });
});

describe("the Admin console tab", () => {
    const adminRun = (over: Partial<Dao> = {}) => pageDao({admin: THIRD, ...over});

    it("is shown to the admin, and opens the console route", () => {
        renderShell({dao: adminRun(), wallet: THIRD});
        const tab = screen.getByTestId("admin-console-link");
        expect(tab).toHaveTextContent("Admin console");
        expect(tab).toHaveAttribute("href", "/dao/4/admin");
        fireEvent.click(tab);
        expect(nav.push).toHaveBeenCalledWith("/dao/4/admin");
    });

    it("is shown to the pending admin", () => {
        renderShell({dao: adminRun({pending_admin: OTHER}), wallet: OTHER});
        expect(screen.getByTestId("admin-console-link")).toBeInTheDocument();
    });

    it("is not shown to another wallet, nor without a wallet", () => {
        const {unmount} = renderShell({dao: adminRun(), wallet: WALLET});
        expect(screen.queryByTestId("admin-console-link")).toBeNull();
        unmount();
        renderShell({dao: adminRun(), wallet: null});
        expect(screen.queryByTestId("admin-console-link")).toBeNull();
    });

    it("a self-owned DAO has no console tab, even for its members", () => {
        renderShell({wallet: WALLET});
        expect(screen.queryByTestId("admin-console-link")).toBeNull();
    });
});

describe("the Proposals counter", () => {
    it("full data: '1/9' with its title", () => {
        renderShell({data: {proposals_open: 1, proposals_total: 9}, open: 5});
        const pill = screen.getByTestId("proposals-counter");
        expect(pill).toHaveTextContent("1/9");
        expect(pill).toHaveAttribute("title", "1 voting now, 9 proposals in all");
    });

    it("partial data (an older Scan or Scan down): only the open count", () => {
        const {unmount} = renderShell({data: {proposals_open: 2}});
        expect(screen.getByTestId("proposals-counter")).toHaveTextContent(/^2$/);
        unmount();
        renderShell({data: null, open: 3});
        expect(screen.getByTestId("proposals-counter")).toHaveTextContent(/^3$/);
    });

    it("nothing known: no pill", () => {
        renderShell({data: null, chainDown: true});
        expect(screen.queryByTestId("proposals-counter")).toBeNull();
        expect(screen.getByTestId("dao-tab-proposals")).toHaveTextContent(/^Proposals$/);
    });
});
