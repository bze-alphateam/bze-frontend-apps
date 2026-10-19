import {LuBadgeCheck} from "react-icons/lu";
import {StatusPill} from "@bze/bze-ui-kit";

/** The green "Verified" pill next to a verified coin. */
export const VerifiedBadge = () => (
    <StatusPill tone="success">
        <LuBadgeCheck size={12} aria-hidden/> Verified
    </StatusPill>
);
