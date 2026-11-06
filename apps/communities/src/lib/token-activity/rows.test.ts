import {describe, expect, it} from "vitest";

import {activityRow, activityRows, groupTransfers, MSG, type ScanTransfer, type ScanTx, type TxGroup} from "./index";

const VDL = "factory/bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l/vidulum";
const TOKEN = {denom: VDL, symbol: "VDL", exponent: 6};
const CREATOR = "bze1z3mkcr2jz424w6m49frgjmy9uhlrx69phqwg3l";
const TRADER = "bze142cru2h3xa6p4kajyg7wzcuweq0p72puyar263";
const DEX = "bze18mhtjwczlzqqgvw84uz8lrdv4hqule3jp8allp";
const REWARDS = "bze1245yut9zht8q4hz39sd0lzqtzkuw5us58k46ua";
const BURNER = "bze1v7uw4xhrcv0vk7qp8jf9lu3hm5d8uu5yjp5qun";
const FEES = "bze17xpfvakm2amg962yls6f84z3kell8c5lda0te2";
const ESCROW = "bze1escrow0000000000000000000000000000000";

const moduleLabel = (name: string) => ({name, kind: "module"});

let seq = 0;
/** A VDL transfer row, as `/token/transfers` sends it. */
const move = (over: Partial<ScanTransfer>): ScanTransfer => ({
    height: 100,
    tx_index: 0,
    tx_hash: "A".repeat(64),
    time: "2026-11-04T11:41:10Z",
    seq: seq++,
    msg_index: 0,
    msg_type: MSG.send,
    kind: "transfer",
    sender: TRADER,
    sender_label: null,
    recipient: CREATOR,
    recipient_label: null,
    denom: VDL,
    amount: "1000000",
    symbol: "VDL",
    exponent: 6,
    ...over,
});

/** A `/txs/{hash}` answer with what the rows read. */
const tx = (over: Partial<ScanTx>): ScanTx => ({
    height: 100,
    tx_index: 0,
    hash: "A".repeat(64),
    time: "2026-11-04T11:41:10Z",
    success: true,
    msg_count: 1,
    msg_types: [],
    fee: [{denom: "ubze", amount: "3902"}],
    signer: TRADER,
    signers: [TRADER],
    fee_payer: TRADER,
    memo: null,
    code: 0,
    error_log: null,
    gas_wanted: 0,
    gas_used: 0,
    messages: [],
    transfers: [{seq: 0, msg_index: null, kind: "transfer", sender: TRADER, sender_label: null, recipient: FEES, recipient_label: moduleLabel("Fee collector"), denom: "ubze", amount: "3902", symbol: "BZE", exponent: 6}],
    dex: null,
    ibc_transfers: null,
    ...over,
});

const groupOf = (moves: ScanTransfer[]): TxGroup => {
    const [group] = groupTransfers(moves, false);
    if (!group) throw new Error("no group");
    return group;
};

/** The row of one transaction made of `moves`, read with `detail` when given. */
const rowOf = (moves: ScanTransfer[], detail?: Partial<ScanTx>) => activityRow(groupOf(moves), detail ? tx(detail) : undefined, TOKEN);

describe("groupTransfers", () => {
    it("makes one group per transaction, newest first, with its fee rows apart", () => {
        const groups = groupTransfers([
            move({tx_hash: "B".repeat(64), height: 101, msg_index: 0}),
            move({tx_hash: "B".repeat(64), height: 101, msg_index: null, msg_type: null, recipient: FEES}),
            move({tx_hash: "B".repeat(64), height: 101, msg_index: 1}),
            move({tx_hash: "A".repeat(64), height: 100}),
        ], false);

        expect(groups.map((g) => [g.txHash[0], g.moves.length, g.feeRows.length])).toEqual([["B", 2, 1], ["A", 1, 0]]);
    });

    it("skips block-level rows (unlocks, burner and raffle burns, epoch payouts)", () => {
        const groups = groupTransfers([
            move({tx_hash: null, tx_index: -1, msg_index: null, msg_type: null, sender: DEX, recipient: BURNER}),
            move({tx_hash: "A".repeat(64)}),
            move({tx_hash: null, tx_index: -1, msg_index: null, msg_type: null, sender: REWARDS, recipient: TRADER}),
        ], false);

        expect(groups.map((g) => g.txHash)).toEqual(["A".repeat(64)]);
    });

    it("skips a transaction whose only rows are its fee paid in the token", () => {
        const groups = groupTransfers([move({msg_index: null, msg_type: null, recipient: FEES})], false);

        expect(groups).toEqual([]);
    });

    it("holds the last transaction back while more pages may continue it", () => {
        const rows = [move({tx_hash: "B".repeat(64)}), move({tx_hash: "A".repeat(64), msg_index: 0})];

        expect(groupTransfers(rows, true).map((g) => g.txHash[0])).toEqual(["B"]);
        expect(groupTransfers(rows, false).map((g) => g.txHash[0])).toEqual(["B", "A"]);
    });

    it("holds back the last transaction even when block rows follow it", () => {
        const rows = [move({tx_hash: "B".repeat(64)}), move({tx_hash: "A".repeat(64)}), move({tx_hash: null, msg_index: null})];

        expect(groupTransfers(rows, true).map((g) => g.txHash[0])).toEqual(["B"]);
    });
});

describe("activityRow — the canvas rows (testnet, 2026-11-05)", () => {
    it("AF3A…8900: four claims, two paying VDL → Claim +3, 75.999999 VDL, fee 0.003902 BZE", () => {
        const moves = [
            move({msg_index: 3, msg_type: MSG.claimStakingRewards, sender: REWARDS, sender_label: moduleLabel("Rewards"), recipient: CREATOR, amount: "19999999"}),
            move({msg_index: 2, msg_type: MSG.claimDenomRewards, sender: REWARDS, sender_label: moduleLabel("Rewards"), recipient: CREATOR, amount: "56000000"}),
        ];
        const row = rowOf(moves, {msg_count: 4, signer: CREATOR});

        expect(row).toMatchObject({tag: "Claim", more: 3, title: "Claimed rewards", actor: CREATOR, amount: "75999999", direction: "in", detailed: true});
        expect(row.fee).toEqual([{denom: "ubze", amount: "3902", symbol: "BZE", exponent: 6}]);
    });

    it("A082…C6F9: creating the TMS / VDL pool", () => {
        const moves = [move({msg_type: MSG.createLiquidityPool, sender: TRADER, recipient: DEX, recipient_label: moduleLabel("DEX"), amount: "5000000000"})];
        const row = rowOf(moves, {
            messages: [{msg_index: 0, type_url: MSG.createLiquidityPool, sender: TRADER, module: "tradebin", events: [],
                body: {base: "factory/bze142cru2h3xa6p4kajyg7wzcuweq0p72puyar263/utms", quote: VDL}}],
            transfers: [
                ...tx({}).transfers,
                {seq: 1, msg_index: 0, kind: "transfer", sender: TRADER, sender_label: null, recipient: DEX, recipient_label: null, denom: "factory/bze142cru2h3xa6p4kajyg7wzcuweq0p72puyar263/utms", amount: "1", symbol: "TMS", exponent: 6},
            ],
        });

        expect(row).toMatchObject({tag: "Liquidity", title: "Created the TMS / VDL pool", amount: "5000000000", direction: "out"});
    });

    it("FF07…4AEB / A8E3…7171: swaps read as Sold / Bought from the signer's side", () => {
        const sold = rowOf([move({msg_type: MSG.multiSwap, sender: TRADER, recipient: DEX, recipient_label: moduleLabel("DEX"), amount: "5000000000"})], {});
        const bought = rowOf([move({msg_type: MSG.multiSwap, sender: DEX, sender_label: moduleLabel("DEX"), recipient: TRADER, amount: "2294471843"})], {});

        expect([sold.tag, sold.title, sold.amount]).toEqual(["Swap", "Sold VDL", "5000000000"]);
        expect([bought.tag, bought.title, bought.amount]).toEqual(["Swap", "Bought VDL", "2294471843"]);
    });

    it("4822…F98F: a fee paid in VDL shows before the transaction is read, and the net is the signer's", () => {
        const moves = [
            move({msg_type: MSG.multiSwap, sender: DEX, sender_label: moduleLabel("DEX"), recipient: BURNER, recipient_label: moduleLabel("Burner"), amount: "752"}),
            move({msg_type: MSG.multiSwap, sender: CREATOR, recipient: DEX, recipient_label: moduleLabel("DEX"), amount: "1002829"}),
            move({msg_type: MSG.multiSwap, sender: DEX, sender_label: moduleLabel("DEX"), recipient: CREATOR, amount: "99690964"}),
            move({msg_index: null, msg_type: null, sender: CREATOR, recipient: FEES, recipient_label: moduleLabel("Stakers fee collector"), amount: "94011"}),
        ];
        const row = rowOf(moves);

        expect(row).toMatchObject({tag: "Swap", title: "Bought VDL", actor: CREATOR, amount: "98688135", detailed: false});
        expect(row.fee).toEqual([{denom: VDL, amount: "94011", symbol: "VDL", exponent: 6}]);
    });

    it("8E56…F595: sent to the burner", () => {
        const row = rowOf([move({msg_type: MSG.fundBurner, recipient: BURNER, recipient_label: moduleLabel("Burner"), amount: "14000000"})], {});

        expect(row).toMatchObject({tag: "Burn", title: "Sent to the burner", amount: "14000000"});
    });
});

describe("activityRow — tags", () => {
    const cases: [string, string, string][] = [
        [MSG.addLiquidity, "Liquidity", "Added liquidity"],
        [MSG.removeLiquidity, "Liquidity", "Removed liquidity"],
        [MSG.fillOrders, "Order", "Filled orders"],
        [MSG.cancelOrder, "Order", "Cancelled an order"],
        [MSG.joinDenomReward, "Stake", "Staked in the holders pool"],
        [MSG.joinStaking, "Stake", "Staked in a reward program"],
        [MSG.exitDenomReward, "Unstake", "Started unstaking"],
        [MSG.exitStaking, "Unstake", "Started unstaking"],
        [MSG.claimStakingRewards, "Claim", "Claimed rewards"],
        [MSG.createStakingReward, "Rewards", "Started a reward program"],
        [MSG.createDenomRewardSchedule, "Rewards", "Started a reward program"],
        [MSG.updateStakingReward, "Rewards", "Extended a reward program"],
        [MSG.distributeDenomRewards, "Rewards", "Added rewards"],
        [MSG.burn, "Burn", "Burned"],
        [MSG.joinRaffle, "Raffle", "Joined the raffle"],
        [MSG.startRaffle, "Raffle", "Started a raffle"],
        [MSG.mint, "Mint", "Minted 1 VDL"],
        [MSG.send, "Transfer", "Sent 1 VDL"],
        ["/cosmos.gov.v1.MsgDeposit", "Transfer", "Sent 1 VDL"],
    ];

    it.each(cases)("%s → %s", (typeUrl, tag, title) => {
        const row = rowOf([move({msg_type: typeUrl})], {});

        expect([row.tag, row.title]).toEqual([tag, title]);
    });

    it("never calls a reward tag anything but Rewards", () => {
        for (const typeUrl of [MSG.createDenomReward, MSG.updateDenomRewardSchedule, MSG.distributeStakingRewards, MSG.createTradingReward, MSG.activateTradingReward]) {
            expect(rowOf([move({msg_type: typeUrl})]).tag).toBe("Rewards");
        }
    });

    it("titles an order by its side", () => {
        const order = (side: string) => rowOf([move({msg_type: MSG.createOrder, recipient: DEX, recipient_label: moduleLabel("DEX")})], {
            messages: [{msg_index: 0, type_url: MSG.createOrder, sender: TRADER, module: "tradebin", events: [], body: {order_type: side}}],
        });

        expect([order("sell").tag, order("sell").title, order("buy").title]).toEqual(["Order", "Placed a sell order", "Placed a buy order"]);
    });

    it("reads Received for a MsgSend to the signer", () => {
        const row = rowOf([move({sender: CREATOR, recipient: TRADER})], {signer: TRADER});

        expect([row.title, row.direction]).toEqual(["Received 1 VDL", "in"]);
    });

    it("names the other chain of a cross-chain row from its escrow label", () => {
        const row = rowOf([move({msg_type: MSG.ibcTransfer, recipient: ESCROW, recipient_label: {name: "Cross-chain escrow (Osmosis)", kind: "ibc_escrow"}})], {});

        expect(row).toMatchObject({tag: "Cross-chain", title: "Sent to Osmosis", chain: "Osmosis", actor: TRADER});
    });

    it("names the other chain from Scan's matched transfer when there is no escrow (an IBC token going home)", () => {
        const moves = [move({kind: "burn", msg_type: MSG.ibcTransfer, recipient: null})];
        const detail = {ibc_transfers: [{channel_id: "channel-0", sequence: 1, direction: "out" as const, status: "pending", sender: TRADER, receiver: "lumen1x", denom: VDL, amount: "1", counterparty: {chain_id: "lumen-1", pretty_name: "Lumen", logo_url: null}}]};

        expect(rowOf(moves, detail).title).toBe("Sent to Lumen");
        expect(rowOf(moves).title).toBe("Sent to another chain");
    });

    it("tags an inbound packet Cross-chain too", () => {
        const row = rowOf([move({msg_type: MSG.ibcRecvPacket, sender: ESCROW, sender_label: {name: "Cross-chain escrow (Lumen)", kind: "ibc_escrow"}, recipient: TRADER})]);

        expect([row.tag, row.title, row.actor]).toEqual(["Cross-chain", "Received from Lumen", TRADER]);
    });
});

describe("activityRow — authz MsgExec and several messages", () => {
    it("uses the inner type Scan resolved for a MsgExec of one kind", () => {
        // Scan's msg_type is already the inner type when every inner message shares it.
        expect(rowOf([move({msg_type: MSG.joinDenomReward})]).tag).toBe("Stake");
    });

    it("unwraps a mixed MsgExec through the transaction's message body", () => {
        const moves = [move({msg_type: MSG.exec, recipient: DEX, recipient_label: moduleLabel("DEX")})];
        const detail = {
            messages: [{msg_index: 0, type_url: MSG.exec, sender: TRADER, module: "authz", events: [], body: {
                grantee: TRADER,
                msgs: [{"@type": MSG.createOrder, order_type: "buy"}, {"@type": MSG.cancelOrder}],
            }}],
        };

        expect(rowOf(moves, detail)).toMatchObject({tag: "Order", title: "Placed a buy order"});
        // Until the transaction is read, a mixed MsgExec has nothing to unwrap.
        expect(rowOf(moves).tag).toBe("Transfer");
    });

    it("tags by the first message that moves the token and counts the others as +N", () => {
        const moves = [
            move({msg_index: 2, msg_type: MSG.fundBurner, recipient: BURNER, recipient_label: moduleLabel("Burner")}),
            move({msg_index: 1, msg_type: MSG.multiSwap, recipient: DEX, recipient_label: moduleLabel("DEX")}),
        ];

        // Before the transaction is read, the count comes from the messages the rows show.
        expect([rowOf(moves).tag, rowOf(moves).more]).toEqual(["Swap", 1]);
        expect(rowOf(moves, {msg_count: 3}).more).toBe(2);
    });

    it("keeps +0 for a single message", () => {
        expect(rowOf([move({})], {msg_count: 1}).more).toBe(0);
    });
});

describe("activityRow — actor, amount and fee", () => {
    it("falls back to the party the rows show before the transaction is read", () => {
        const row = rowOf([move({sender: DEX, sender_label: moduleLabel("DEX"), recipient: TRADER, msg_type: MSG.multiSwap})]);

        expect([row.actor, row.title]).toEqual([TRADER, "Bought VDL"]);
    });

    it("shows the largest move when the signer only moved others' tokens (a grantee)", () => {
        const row = rowOf([move({sender: CREATOR, recipient: DEX, amount: "5"}), move({sender: CREATOR, recipient: BURNER, amount: "9"})], {signer: TRADER});

        expect([row.amount, row.direction]).toEqual(["9", "none"]);
    });

    it("sums a fee paid in two rows of one denom and keeps the fee coins without rows", () => {
        const fee = (amount: string) => ({seq: 0, msg_index: null, kind: "transfer" as const, sender: TRADER, sender_label: null, recipient: FEES, recipient_label: null, denom: "ubze", amount, symbol: "BZE", exponent: 6});

        expect(rowOf([move({})], {transfers: [fee("1"), fee("2")]}).fee).toEqual([{denom: "ubze", amount: "3", symbol: "BZE", exponent: 6}]);
        expect(rowOf([move({})], {transfers: [], fee: [{denom: "ubze", amount: "7"}]}).fee).toEqual([{denom: "ubze", amount: "7", symbol: null, exponent: null}]);
        expect(rowOf([move({})]).fee).toBeNull();
    });
});

describe("activityRows", () => {
    it("matches each transaction with the one read for it", () => {
        const rows = activityRows(
            [move({tx_hash: "B".repeat(64)}), move({tx_hash: "A".repeat(64)})],
            {hasMore: false, txs: new Map([["A".repeat(64), tx({msg_count: 2})]]), token: TOKEN},
        );

        expect(rows.map((r) => [r.txHash[0], r.detailed, r.more])).toEqual([["B", false, 0], ["A", true, 1]]);
    });
});
