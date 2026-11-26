'use client'

import {Notice} from '../hive-glow/status';

// Same wording as the chain-error table (utils/user_errors.ts), so the pre-check and the chain's
// refusal read alike.
export const DENOM_STOPPED_TEXT = 'Transfers of this token to and from other chains are stopped for now.';
export const ROUTE_STOPPED_TEXT = 'Transfers on this route are stopped for now.';

/** Why a bridge form cannot be submitted: the guardian blocked the token or closed the route. */
export const RouteStoppedNotice = ({denomBlocked, channelClosed}: {denomBlocked: boolean; channelClosed: boolean}) => {
    if (!denomBlocked && !channelClosed) return null;
    return (
        <Notice status="warning">
            {denomBlocked ? DENOM_STOPPED_TEXT : ROUTE_STOPPED_TEXT}
        </Notice>
    );
};
