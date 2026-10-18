import BigNumber from "bignumber.js";
import type { GovVote } from "@bze/bze-ui-kit";
import type { ProposalVoter } from "@/hooks/useVoter";

// Test data for the connected-wallet variants of the governance pages.

export const ME = "bze1me";

export const vote = (...options: [string, string][]): GovVote => ({
    proposal_id: "48", voter: ME, metadata: "", options: options.map(([option, weight]) => ({ option, weight })) as GovVote["options"],
});

export const YES = vote(["VOTE_OPTION_YES", "1.000000000000000000"]);
export const SPLIT = vote(["VOTE_OPTION_YES", "0.600000000000000000"], ["VOTE_OPTION_NO", "0.400000000000000000"]);

/** Hive Node (15,000 BZE, voted Yes) and Comb Staking (10,400 BZE, not voted) unless overridden. */
export function voterOf({ vote: own = null, inactive = "0", validators }: {
    vote?: GovVote | null; inactive?: string; validators?: [string, string, GovVote | null][];
} = {}): ProposalVoter {
    const rows = (validators ?? [["Hive Node", "15000000000", YES], ["Comb Staking", "10400000000", null]]).map(([moniker, amount, v]) => ({
        validator: { operator_address: `bzevaloper1${moniker.replace(" ", "").toLowerCase()}`, description: { moniker } } as never,
        amount: new BigNumber(amount),
        moniker,
        vote: v,
    }));
    const power = rows.reduce((sum, r) => sum.plus(r.amount), new BigNumber(0));
    return {
        power: { power, inactive: new BigNumber(inactive), validators: rows },
        vote: own,
        validators: rows,
    };
}
