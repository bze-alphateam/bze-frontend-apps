'use client'

import {Text} from '@chakra-ui/react';

interface DepositLimitNoteProps {
    /** True once a deposit has been signed and sent: the note then also says where a refusal shows up. */
    sent?: boolean;
}

/**
 * v8.3.0 daily limits per IBC route. A deposit over the remaining limit is refused on BeeZee and
 * refunded on the source chain, so the user finds out there, not in our form.
 */
export const DepositLimitNote = ({sent = false}: DepositLimitNoteProps) => (
    <Text fontSize="xs" color="fg.muted" data-testid="deposit-limit-note">
        Transfers between BeeZee and other chains have a daily limit per route. A deposit over the
        remaining limit is refunded to you on the source chain.
        {sent && ' If your balance does not change, check the source chain: refused deposits are refunded there.'}
    </Text>
);
