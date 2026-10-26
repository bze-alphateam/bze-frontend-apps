import React, {useMemo} from "react";
import {LuGift, LuLock, LuLockOpen, LuWallet} from "react-icons/lu";
import {Box, Button} from "@chakra-ui/react";
import {TYPE_BALANCE, TYPE_REWARDS, TYPE_STAKING, TYPE_UNLOCK} from "@/components/ui/staking/rewards-staking-alerts";

export const RewardsStakingIcon = ({type}: {type: 'rewards' | 'staking' | 'unlock' | 'balance'}) => {
    return useMemo(() => {
        switch (type) {
            case TYPE_REWARDS: return <LuGift size={14}/>;
            case TYPE_STAKING: return <LuLock size={14}/>;
            case TYPE_UNLOCK: return <LuLockOpen size={14}/>;
            case TYPE_BALANCE: return <LuWallet size={14}/>;
        }
    }, [type])
}

/** The DEX soft button: an app-tinted outline, for actions next to a card's main one (Stake, Claim). */
export const softButtonStyle = {
    variant: 'outline' as const,
    color: 'hg.link',
    borderColor: 'app.border',
    bg: 'app.subtle',
    borderRadius: 'hg.md',
    fontWeight: '600',
    _hover: {bg: 'app.muted'},
    _disabled: {opacity: 0.5},
};

/** The neutral outline for leaving actions (Unlock, Unstake, Exit), with the amber lock-open icon. */
export const leaveButtonStyle = {
    variant: 'outline' as const,
    color: 'fg',
    borderColor: 'hg.lineStrong',
    bg: 'transparent',
    borderRadius: 'hg.md',
    fontWeight: '600',
    _hover: {bg: 'hg.hoverFill'},
    _disabled: {opacity: 0.5},
};

interface RewardsStakingButtonProps extends React.ComponentPropsWithoutRef<typeof Button> {
    buttonType: 'rewards' | 'staking' | 'unlock' | 'balance';
    children?: React.ReactNode;
}

/** Stake / Claim are the DEX soft button; Unlock is the neutral outline with the amber icon. */
export const RewardsStakingButton = ({
                                         buttonType,
                                         children,
                                         disabled,
                                         onClick,
                                         ...buttonProps
                                     }: RewardsStakingButtonProps) => {
    const leaving = buttonType === TYPE_UNLOCK

    return (
        <Button
            flex="1"
            size="md"
            {...(leaving ? leaveButtonStyle : softButtonStyle)}
            disabled={disabled}
            onClick={onClick}
            w='full'
            gap="6px"
            {...buttonProps}
        >
            <Box as="span" display="inline-flex" color={leaving ? 'hg.warning' : undefined}>
                <RewardsStakingIcon type={buttonType} />
            </Box>
            {children}
        </Button>
    )
}
