import type {ReactNode} from "react";
import {describe, expect, it, vi} from "vitest";
import {render, screen, within} from "@testing-library/react";
import {ChakraProvider, defaultSystem} from "@chakra-ui/react";
import BigNumber from "bignumber.js";
import type {DaoVotingPowerResponse} from "@bze/bze-ui-kit";

// prices: 1 BZE = $0.04, HONEY has none
vi.mock("@bze/bze-ui-kit", async (importActual) => ({
    ...(await importActual<typeof import("@bze/bze-ui-kit")>()),
    useToast: () => ({toast: {error: vi.fn()}}),
    getDexApp: () => ({href: "https://dex.example"}),
    useAssets: () => ({
        getAsset: (denom: string) => (denom === "ubze" || denom === "uhoney" ? {denom, decimals: 6} : undefined),
        denomTicker: (denom: string) => (({ubze: "BZE", uhoney: "HONEY"}) as Record<string, string>)[denom] ?? denom,
    }),
    useAssetsValue: () => ({
        denomUsdValue: (denom: string, amount: BigNumber) => (denom === "ubze" ? amount.shiftedBy(-6).multipliedBy(0.04) : new BigNumber(0)),
    }),
}));

import {OTHER, WALLET} from "@/test/composer-fixtures";
import {pageDao} from "@/test/dao-page-fixtures";
import type {DaoViewDeps, MyVotes} from "@/lib/dao-view-loader";
import type {StakeSource} from "@/lib/dao-voters";
import {MyPower} from "./my-power";
import {TreasuryPanel} from "./panels";
import {VotersPanel} from "./voters-panels";

const wrap = (ui: ReactNode) => render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);

describe("Treasury", () => {
    it("the USD total on the right of the title, one row per token with its letter badge, amount and value", () => {
        wrap(<TreasuryPanel treasury={{ok: true, value: [{denom: "ubze", amount: "250000000000"}]}} />);
        expect(screen.getByTestId("treasury-total")).toHaveTextContent("≈ $10,000");
        const row = screen.getByTestId("treasury-row");
        expect(within(row).getByTestId("treasury-badge")).toHaveTextContent("B");
        expect(row).toHaveTextContent("BZE");
        expect(within(row).getByTestId("treasury-amount")).toHaveTextContent("250,000");
        expect(within(row).getByTestId("treasury-usd")).toHaveTextContent("≈ $10,000");
    });

    it("a token without a price has no value line and stays out of the total, which says so", () => {
        wrap(<TreasuryPanel treasury={{ok: true, value: [{denom: "ubze", amount: "1000000000"}, {denom: "uhoney", amount: "40000000000"}]}} />);
        const total = screen.getByTestId("treasury-total");
        expect(total).toHaveTextContent("≈ $40.00");
        expect(total).toHaveAttribute("data-partial", "true");
        expect(total).toHaveAttribute("title", "Tokens without a price are left out");
        const [, honey] = screen.getAllByTestId("treasury-row");
        expect(within(honey).getByTestId("treasury-badge")).toHaveTextContent("H");
        expect(within(honey).queryByTestId("treasury-usd")).toBeNull();
    });

    it("no prices at all: no total; empty and unreadable treasuries say so", () => {
        const {unmount} = wrap(<TreasuryPanel treasury={{ok: true, value: [{denom: "uhoney", amount: "1"}]}} />);
        expect(screen.queryByTestId("treasury-total")).toBeNull();
        unmount();
        const empty = wrap(<TreasuryPanel treasury={{ok: true, value: []}} />);
        expect(screen.getByTestId("treasury-empty")).toBeInTheDocument();
        empty.unmount();
        wrap(<TreasuryPanel treasury={{ok: false}} />);
        expect(screen.getByTestId("treasury-panel")).toHaveTextContent("could not be read");
    });
});

describe("Who votes", () => {
    it("a member list: the Member list pill, the count line, one row per member with 'You' on the wallet's", () => {
        wrap(<VotersPanel dao={pageDao()} sources={{ok: true, value: []}} nameOf={(a) => (a === OTHER ? "Ana · builder" : undefined)} wallet={WALLET} />);
        expect(screen.getByTestId("voters-kind")).toHaveTextContent("Member list");
        expect(screen.getByTestId("member-count")).toHaveTextContent("2 members · one vote each");
        const [mine, other] = screen.getAllByTestId("member");
        expect(within(mine).getByTestId("member-you")).toHaveTextContent("You");
        expect(within(mine).getByTestId("member-address")).toHaveAttribute("title", WALLET);
        expect(within(other).queryByTestId("member-you")).toBeNull();
        expect(other).toHaveTextContent("Ana · builder");
    });

    it("an empty member list is the 'Empty electorate' note", () => {
        wrap(<VotersPanel dao={pageDao({members: []})} sources={{ok: true, value: []}} nameOf={() => undefined} />);
        expect(screen.getByTestId("no-voters")).toHaveAttribute("role", "note");
        expect(screen.getByTestId("no-voters")).toHaveTextContent("Empty electorate");
        expect(screen.getByTestId("no-voters")).toHaveTextContent("No voters yet.");
    });

    it("stakers: one row per source with its lock, its stake and Stake on DEX, then the total voting power", () => {
        const sources: StakeSource[] = [
            {kind: "dr", stakingDenom: "uhoney", lockDays: 7, staked: "1906000000000", own: "0"},
            {kind: "sr", id: "000000000012", stakingDenom: "uhoney", lockDays: 14, staked: "1412500000000", own: "0"},
        ];
        wrap(<VotersPanel dao={pageDao({type: "DAO_TYPE_STAKE", members: []})} sources={{ok: true, value: sources}} nameOf={() => undefined} />);
        expect(screen.getByTestId("voters-kind")).toHaveTextContent("Stakers");
        expect(screen.getByTestId("voters-panel")).toHaveTextContent("Anyone staking HONEY in these rewards. Voting power = stake.");
        const [dr, sr] = screen.getAllByTestId("source-row");
        expect(dr).toHaveTextContent("Compounded reward");
        expect(dr).toHaveTextContent("HONEY · 7-day unstaking lock");
        expect(within(dr).getByTestId("source-staked")).toHaveTextContent("1,906,000 HONEY");
        expect(sr).toHaveTextContent("Simple reward #12");
        expect(within(sr).getByTestId("source-link")).toHaveAttribute("href", "https://dex.example/staking/details?id=simple%3A000000000012");
        expect(screen.getByTestId("total-power")).toHaveTextContent("Total voting power3,318,500 HONEY(the DAO's own stake never counts)");
    });
});

describe("Your voting power", () => {
    const powerDeps = (power: DaoVotingPowerResponse, votes: MyVotes["items"] = [], votesFail = false) => ({
        chain: {getVotingPower: vi.fn(async () => power)},
        scan: {votesByVoter: vi.fn(async () => {
            if (votesFail) throw new Error("scan down");
            return {items: votes, next_cursor: null, supported: true};
        })},
    }) as unknown as DaoViewDeps;
    const vote = (id: number, option: string, title: string) => ({
        proposal: {id, title, status: "voting", voting_end: null}, dao: {id: 4, name: "Founders"}, option, weight: "1", effective_weight: "1", height: 1, tx_hash: null, time: "2026-11-01T00:00:00Z",
    }) as MyVotes["items"][number];

    it("a staker: the Staker pill, the stake, what counts on each open proposal, why some does not, and past votes", async () => {
        const dao = pageDao({type: "DAO_TYPE_STAKE", members: []});
        const sources = {ok: true as const, value: [{kind: "dr" as const, stakingDenom: "uhoney", lockDays: 7, staked: "1", own: "0"}]};
        const open = {ok: true as const, value: [{id: "21", title: "Fund the liquidity push"}, {id: "22", title: "Rename"}] as never};
        wrap(<MyPower
            deps={powerDeps({current: "42000000000", proposals: [{proposal_id: "21", eligible_weight: "30000000000", shares: []}, {proposal_id: "22", eligible_weight: "42000000000", shares: []}]}, [vote(19, "YES", "Buy back HONEY"), vote(17, "NO", "Raise the deposit")])}
            dao={dao} wallet={WALLET} sources={sources} openProposals={open} />);
        expect(await screen.findByTestId("power-headline")).toHaveTextContent("42,000 HONEY");
        expect(screen.getByTestId("power-role")).toHaveTextContent("Staker");
        const [p21, p22] = screen.getAllByTestId("power-proposal");
        expect(p21).toHaveTextContent("#21 Fund the liquidity push30,000 of 42,000");
        expect(within(p21).getByRole("link")).toHaveAttribute("href", "/proposal/21");
        expect(p22).toHaveTextContent("#22 Rename42,000");
        expect(screen.getByTestId("power-note")).toHaveTextContent("On #21 only part of your stake counts: you joined or added to it after #21 started.");
        const votes = await screen.findAllByTestId("my-vote");
        expect(votes[0]).toHaveTextContent("#19 Buy back HONEYYes");
        expect(votes[1]).toHaveTextContent("#17 Raise the depositNo");
    });

    it("a member: '1 vote', the Member pill, 'Not voted' on an open proposal it has not voted on, its option where it has", async () => {
        const open = {ok: true as const, value: [{id: "24", title: "Add a member"}, {id: "25", title: "Pay the audit"}] as never};
        wrap(<MyPower
            deps={powerDeps({current: "1", proposals: [{proposal_id: "24", eligible_weight: "1", shares: []}, {proposal_id: "25", eligible_weight: "1", shares: []}]}, [vote(25, "YES", "Pay the audit")])}
            dao={pageDao()} wallet={WALLET} sources={{ok: true, value: []}} openProposals={open} />);
        expect(await screen.findByTestId("power-headline")).toHaveTextContent("1 vote");
        expect(screen.getByTestId("power-role")).toHaveTextContent("Member");
        await screen.findAllByTestId("my-vote");
        const [p24, p25] = screen.getAllByTestId("power-proposal");
        expect(within(p24).getByTestId("power-not-voted")).toHaveTextContent("Not voted");
        expect(p25).toHaveTextContent("Yes");
    });

    it("Scan down: the open proposals never claim 'Not voted', and the votes offer a retry", async () => {
        const open = {ok: true as const, value: [{id: "24", title: "Add a member"}] as never};
        wrap(<MyPower
            deps={powerDeps({current: "1", proposals: [{proposal_id: "24", eligible_weight: "1", shares: []}]}, [], true)}
            dao={pageDao()} wallet={WALLET} sources={{ok: true, value: []}} openProposals={open} />);
        expect(await screen.findByTestId("power-proposal")).toHaveTextContent("Can vote");
        expect(await screen.findByTestId("scan-retry")).toHaveTextContent("Your votes");
        expect(screen.queryByTestId("power-not-voted")).toBeNull();
    });

    it("not a member and no votes: the neutral pill, 'No vote' and the empty line", async () => {
        wrap(<MyPower deps={powerDeps({current: "0", proposals: []})} dao={pageDao()} wallet={WALLET} sources={{ok: true, value: []}} openProposals={{ok: true, value: []}} />);
        expect(await screen.findByTestId("power-headline")).toHaveTextContent("No vote");
        expect(screen.getByTestId("power-role")).toHaveTextContent("Not a member");
        expect(await screen.findByTestId("no-votes")).toHaveTextContent("You haven't voted here yet.");
    });
});
