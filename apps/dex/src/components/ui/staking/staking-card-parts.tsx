import {chakra} from "@chakra-ui/react";
import type {ReactNode} from "react";

// Small tags shared by /staking and /assets. The reward kind tags (Native / Simple / Compounded)
// are RewardKindTag in staking-table.tsx.

/** The small neutral mono tag (an asset's type: NATIVE / FACTORY / IBC). */
export const KindTag = ({children}: { children: ReactNode }) => (
    <chakra.span fontFamily="mono" fontSize="11px" px="7px" py="2px" borderRadius="6px" color="hg.text.muted" bg="hg.inset">
        {children}
    </chakra.span>
);

/** The DEX-tinted "Verified" pill. */
export const VerifiedPill = () => (
    <chakra.span fontSize="11px" fontWeight="600" px="8px" py="2px" borderRadius="full" color="hg.link" bg="app.subtle" borderWidth="1px" borderColor="app.border">
        Verified
    </chakra.span>
);
