import type BigNumber from 'bignumber.js'
import type { Asset } from '@bze/bze-ui-kit'
import type { AdminState } from '@/lib/workspace'

/** What the Permissions section (the old Control tab, BFE-273 redesigns it) gets from the token page. */
export interface WorkspaceTabProps {
    asset: Asset;
    /** From useDenomAdmin: an address, '' when renounced, undefined when the lookup failed. */
    admin: string | undefined;
    adminState: AdminState;
    /** Total supply in display units (live, falling back to the asset's snapshot). */
    supplyDisplay: BigNumber;
    /** Live total supply in base units, undefined until loaded. */
    supply?: string;
    isSupplyLoading: boolean;
    /** The connected wallet's balance in display units. */
    balanceDisplay: BigNumber;
    refreshSupply: () => void;
    refreshAdmins: () => Promise<void>;
    /** Follows a link to this same page (replaces the history entry). */
    goTo: (href: string) => void;
}
