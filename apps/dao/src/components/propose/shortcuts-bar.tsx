'use client';

import {chakra, Flex} from '@chakra-ui/react';
import type {Dao} from '@bze/bze-ui-kit';
import type {ProposerStatus} from '@/lib/propose/eligibility';
import {shortcutApplies, shortcutLabel, type Shortcut} from '@/lib/propose/shortcuts';

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

/**
 * "Request to join" and "Leave": one click fills the proposal with the wallet's own members change. Each is
 * shown only when that proposal could be submitted (`shortcutApplies`), so the last member is never offered
 * Leave. Once one is applied it reads "Prefilled" instead of a button.
 */
export const ShortcutsBar = ({dao, wallet, status, applied, full, onApply}: Props) => {
    const offered = full ? [] : SHORTCUTS.filter((s) => shortcutApplies(s, dao, wallet, status));
    if (applied === null && offered.length === 0) return null;

    return (
        <Flex gap="12px" align="center" wrap="wrap" data-testid="shortcuts">
            {applied !== null ? (
                <Flex gap="10px" align="center" wrap="wrap" data-testid="shortcut-applied">
                    <chakra.span fontWeight="700" fontSize="15px">{shortcutLabel(applied, dao.name)}</chakra.span>
                    <chakra.span fontSize="12px" fontWeight="600" px="9px" py="2px" borderRadius="999px" borderWidth="1px" borderColor="app.border" color="fg.muted">Prefilled</chakra.span>
                </Flex>
            ) : offered.map((s) => (
                <chakra.button
                    key={s}
                    type="button"
                    h="40px"
                    px="16px"
                    borderRadius="12px"
                    borderWidth="1px"
                    borderColor="app.border"
                    fontWeight="600"
                    fontSize="14px"
                    cursor="pointer"
                    _hover={{borderColor: 'hg.link'}}
                    onClick={() => onApply(s)}
                    data-testid={`shortcut-${s}`}
                >
                    {shortcutLabel(s, dao.name)}
                </chakra.button>
            ))}
            {applied === null && <chakra.span fontSize="12px" color="fg.muted">Fills in the proposal with your own membership change. The members still vote on it.</chakra.span>}
        </Flex>
    );
};
