'use client';

import {chakra, Flex} from '@chakra-ui/react';
import type {Dao} from '@bze/bze-ui-kit';
import {shortcutApplies, shortcutLabel, type Shortcut} from '@/lib/propose/shortcuts';

interface Props {
    dao: Pick<Dao, 'name' | 'type' | 'members' | 'address' | 'config'>;
    wallet: string | null;
    /** The shortcut that filled the proposal (from a link or a button here), if any. */
    applied: Shortcut | null;
    onApply: (shortcut: Shortcut) => void;
    /** The list already holds the wallet's own members change (a restored draft): no button that would add another. */
    drafted?: boolean;
}

const SHORTCUTS: readonly Shortcut[] = ['join', 'leave'];

/**
 * "Request to join" and "Leave": one click fills the proposal with the wallet's own members change. Each is
 * shown only when that proposal could be submitted (`shortcutApplies`), so the last member is never offered
 * Leave. Once one is applied it reads "Prefilled" instead of a button.
 */
export const ShortcutsBar = ({dao, wallet, applied, onApply, drafted = false}: Props) => {
    const offered = drafted ? [] : SHORTCUTS.filter((s) => shortcutApplies(s, dao, wallet));
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
