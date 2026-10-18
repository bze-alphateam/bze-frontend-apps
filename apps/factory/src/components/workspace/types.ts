import type BigNumber from 'bignumber.js'
import type { Asset } from '@bze/bze-ui-kit'
import type { AdminState } from '@/lib/workspace'

/** What every workspace tab gets from the page. */
export interface WorkspaceTabProps {
    asset: Asset;
    /** From useMyTokens: an address, '' when renounced, undefined when the lookup failed. */
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
    /** Follows an internal link: a workspace link only switches the tab. */
    goTo: (href: string) => void;
}
