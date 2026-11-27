'use client'

import {LuPause} from 'react-icons/lu';
import {Notice} from './hive-glow/status';

/**
 * The chain's message router refuses these message types (x/circuit disable list, set by the
 * guardian). Warning notice: the action is temporarily unavailable, not a user error.
 */
export const PausedActionNotice = () => (
    <Notice status="warning" icon={<LuPause/>} title="This action is paused on BeeZee for now.">
        The chain is not accepting this kind of transaction at the moment. Please try again later.
    </Notice>
);
