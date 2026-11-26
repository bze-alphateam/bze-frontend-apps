import type {Dao} from '@bze/bze-ui-kit';
import {secondsOf} from '../dao-rules';
import {formatDuration, formatRatio} from '../format';

/** The words of the expedited switch: what it changes for this DAO, in its own numbers. */
export function expeditedExplanation(dao: Pick<Dao, 'type' | 'config'>, minExpediteDelay: string): string[] {
    const c = dao.config;
    const regular = secondsOf(c.voting_period);
    const expedited = secondsOf(c.expedited_period);
    const lines = [
        `Voting ends after ${expedited === null ? 'the expedited period' : formatDuration(expedited)} instead of ${regular === null ? 'the usual voting period' : formatDuration(regular)}, and the proposal can be settled early once the votes already decide it.`,
        `The bars are higher and count against all the voting power, not only the votes cast: at least ${formatRatio(c.expedite_quorum)} must take part and more than ${formatRatio(c.expedite_threshold)} must vote Yes.`,
    ];
    if (dao.type === 'DAO_TYPE_STAKE') {
        const delay = secondsOf(minExpediteDelay);
        lines.push(`In a stakers' DAO an expedited proposal cannot be settled early before ${delay === null ? 'the minimum expedite delay' : formatDuration(delay)} have passed.`);
    }
    return lines;
}
