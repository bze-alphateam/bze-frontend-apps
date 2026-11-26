// @vitest-environment jsdom
import {afterEach, describe, expect, it} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import type {ReactNode} from "react";
import type {DaoSourceUsage} from "../query/dao_source_usage";
import {buildDaoSourceNotice} from "./dao-source-notice";

afterEach(cleanup);

const proposal = (id: string) => ({id, title: `P${id}`, daoId: "3", votingEnd: null});
const wrap = (node: ReactNode) => render(<ChakraProvider value={defaultSystem}>{node}</ChakraProvider>);
const text = (usage: DaoSourceUsage, action: "stake" | "exit") => {
    const notice = buildDaoSourceNotice(usage, action);
    if (!notice) return null;
    wrap(<div data-testid="out">{notice.body}</div>);
    return {tone: notice.tone, text: screen.getByTestId("out").textContent};
};

describe("buildDaoSourceNotice", () => {
    const daos = [{id: "3", name: "Club"}];

    it("says nothing when no DAO uses the source", () => {
        expect(buildDaoSourceNotice({daos: [], openProposals: []}, "stake")).toBeNull();
        expect(buildDaoSourceNotice({daos: [], openProposals: []}, "exit")).toBeNull();
    });

    it("warns a join or top-up about the open proposals", () => {
        expect(text({daos, openProposals: [proposal("1"), proposal("2")]}, "stake")).toEqual({
            tone: "warning",
            text: "This program's stake votes in DAO Club. Stake you add now won't count on its 2 open proposals, and a top-up makes your whole stake here stop counting on them. Vote first, then add.",
        });
    });

    it("uses the singular for one open proposal", () => {
        expect(text({daos, openProposals: [proposal("1")]}, "stake")?.text).toContain("its 1 open proposal,");
    });

    it("shows one muted line when DAOs use the source but nothing is open", () => {
        expect(text({daos, openProposals: []}, "stake")).toEqual({tone: "muted", text: "This program's stake votes in DAO Club."});
    });

    it("warns an exit about the open proposals, and is silent without any", () => {
        expect(text({daos, openProposals: [proposal("1"), proposal("2")]}, "exit")).toEqual({
            tone: "warning",
            text: "Leaving now lowers your votes on 2 open proposals of DAO Club, and joining again won't bring them back.",
        });
        expect(buildDaoSourceNotice({daos, openProposals: []}, "exit")).toBeNull();
    });

    it("names every DAO of the source", () => {
        const two = [{id: "3", name: "Club"}, {id: "4", name: "Guild"}];
        expect(text({daos: two, openProposals: [proposal("1")]}, "exit")?.text).toContain("of DAOs Club, Guild,");
    });

    it("links each DAO name to the DAO app", () => {
        wrap(<div>{buildDaoSourceNotice({daos, openProposals: []}, "stake")?.body}</div>);
        expect(screen.getByRole("link", {name: "Club"}).getAttribute("href")).toMatch(/\/dao\/3$/);
    });
});
