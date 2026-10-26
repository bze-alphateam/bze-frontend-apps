import {chakra} from "@chakra-ui/react";
import type {ReactNode} from "react";
import {LuBadgeCheck} from "react-icons/lu";

// Small tags shared by /staking and /assets. The reward kind tags (Native / Simple / Compounded)
// are RewardKindTag in staking-table.tsx.

/** The small neutral mono tag (an asset's type: NATIVE / FACTORY / IBC). */
export const KindTag = ({children}: { children: ReactNode }) => (
    <chakra.span fontFamily="mono" fontSize="11px" px="7px" py="2px" borderRadius="6px" color="hg.text.muted" bg="hg.inset">
        {children}
    </chakra.span>
);

/** "Verified": the reward kind tags' shape (RewardKindTag), in the success green with a check. */
export const VerifiedPill = () => (
    <chakra.span
        flex="none"
        display="inline-flex"
        alignItems="center"
        gap="3px"
        fontFamily="mono"
        fontSize="11px"
        lineHeight="16px"
        px="6px"
        borderRadius="6px"
        borderWidth="1px"
        color="hg.success.text"
        bg="hg.success/10"
        borderColor="hg.success/35"
    >
        <LuBadgeCheck size={11} aria-hidden="true"/>
        Verified
    </chakra.span>
);
