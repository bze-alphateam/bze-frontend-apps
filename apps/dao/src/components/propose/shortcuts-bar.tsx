'use client';

import {Button, chakra, Flex} from '@chakra-ui/react';
import {hgVariant} from '@bze/bze-ui-kit';
import type {Dao} from '@bze/bze-ui-kit';
import type {ProposerStatus} from '@/lib/propose/eligibility';
import {isLastMember, LAST_MEMBER_TEXT, shortcutApplies, shortcutLabel, type Shortcut} from '@/lib/propose/shortcuts';
import {NeutralNote} from './neutral-note';

interface Props {
    dao: Pick<Dao, 'name' | 'type' | 'members' | 'address' | 'config'>;
    wallet: string | null;
    /** Who may propose here: a DAO that cannot take a proposal (blocked) gets no shortcut. */
    status: Pick<ProposerStatus, 'kind'> | null;
    /** The shortcut the draft holds (the wallet's own members change is in the list), if any: it reads "Prefilled". */
    applied: Shortcut | null;
    /** The list has as many actions as a proposal may run: no button that would add one more. */
    full: boolean;
    onApply: (shortcut: Shortcut) => void;
}

const SHORTCUTS: readonly Shortcut[] = ['join', 'leave'];

/** When each shortcut is offered, in the board's words (F4). */
export const SHORTCUT_NOTE: Record<Shortcut, string> = {
    join: "Shown only when you could submit it: the DAO is a member list, you're not a member and anyone can submit proposals. The members still vote on it.",
    leave: "Shown when you're a member and members can submit proposals here, and you're not the last member.",
};

/**
 * "Request to join" and "Leave" (board F4): one click fills the proposal with the wallet's own members change.
 * Each is shown only when that proposal could be submitted (`shortcutApplies`), so the last member is never
 * offered Leave. Once one is applied the main card is titled with it and a "Prefilled" pill.
 */
export const ShortcutsBar = ({dao, wallet, status, applied, full, onApply}: Props) => {
    const offered = full ? [] : SHORTCUTS.filter((s) => shortcutApplies(s, dao, wallet, status));
    if (applied !== null) {
        return (
            <Flex gap="10px" align="center" wrap="wrap" data-testid="shortcut-applied">
                <chakra.h2 m="0" fontSize="17px" fontWeight="700">{shortcutLabel(applied, dao.name)}</chakra.h2>
                <chakra.span
                    fontSize="12px" fontWeight="600" px="9px" py="3px" borderRadius="999px" whiteSpace="nowrap" borderWidth="1px"
                    color={applied === 'join' ? 'app.fg' : 'hg.text.secondary'} bg={applied === 'join' ? 'app.subtle' : 'hg.inset'} borderColor={applied === 'join' ? 'app.border' : 'hg.hairline'}
                >
                    Prefilled
                </chakra.span>
            </Flex>
        );
    }
    // board F4: the last member is told why there is no Leave
    const last = isLastMember(dao, wallet, status) ? <NeutralNote testId="shortcut-last-member">{LAST_MEMBER_TEXT}</NeutralNote> : null;
    if (offered.length === 0) return last;

    return (
        <Flex direction="column" gap="8px" data-testid="shortcuts">
            <Flex gap="10px" align="center" wrap="wrap">
                {offered.map((s) => (
                    <Button key={s} variant={hgVariant('secondary')} size="md" onClick={() => onApply(s)} data-testid={`shortcut-${s}`}>
                        {shortcutLabel(s, dao.name)}
                    </Button>
                ))}
            </Flex>
            <chakra.span fontSize="12px" lineHeight="1.5" color="hg.text.faint">Fills in the proposal with your own membership change. The members still vote on it.</chakra.span>
            {last}
        </Flex>
    );
};
