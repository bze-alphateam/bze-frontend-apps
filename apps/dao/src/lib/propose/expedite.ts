import type {Dao} from '@bze/bze-ui-kit';
import {secondsOf} from '../dao-rules';
import {formatDuration, formatRatio} from '../format';

/**
 * The words under the expedited switch, in the DAO's own numbers: `full` on a desktop, `short` on a phone.
 * A stakers' DAO cannot settle early during its first `min_expedite_delay`; a member list has no such delay.
 */
export function expeditedExplanation(dao: Pick<Dao, 'type' | 'config'>, minExpediteDelay: string): {full: string; short: string} {
    const c = dao.config;
    const seconds = secondsOf(c.expedited_period);
    const period = seconds === null ? 'the expedited period' : formatDuration(seconds);
    const stake = dao.type === 'DAO_TYPE_STAKE';
    const delay = secondsOf(minExpediteDelay);
    const earliest = stake ? `, at the earliest ${delay === null ? 'the minimum expedite delay' : formatDuration(delay)} after submission,` : '';
    const power = stake ? 'all voting power' : 'all members';
    const voted = stake ? 'has voted' : 'have voted';
    return {
        full: `Shorter vote (${period}) that can settle early${earliest} once ${formatRatio(c.expedite_quorum)} of ${power} ${voted} and yes is more than ${formatRatio(c.expedite_threshold)} of ALL ${stake ? 'voting power' : 'members'} (not just of the votes cast). Use it for urgent things.`,
        short: `Shorter vote (${period}) that can settle early.`,
    };
}
