import React, {useMemo} from "react";
import {LuGift, LuLock, LuLockOpen, LuWallet} from "react-icons/lu";
import {Button, HStack} from "@chakra-ui/react";
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
interface RewardsStakingButtonProps extends React.ComponentPropsWithoutRef<typeof Button> {
    buttonType: 'rewards' | 'staking' | 'unlock' | 'balance';
    children?: React.ReactNode;
}

export const RewardsStakingButton = ({
                                         buttonType,
                                         children,
                                         disabled,
                                         onClick,
                                         ...buttonProps
                                     }: RewardsStakingButtonProps) => {
    const buttonColor = useMemo(() => {
        switch (buttonType) {
            case 'rewards': return 'purple';
            case 'staking': return 'blue';
            case 'unlock': return 'orange';
            case 'balance': return 'blue';
        }
    }, [buttonType])

    return (
        <Button
            flex="1"
            colorPalette={buttonColor}
            variant="outline"
            disabled={disabled}
            onClick={onClick}
            w='full'
            p='2'
            {...buttonProps}
        >
            <HStack gap="2">
                <RewardsStakingIcon type={buttonType} />
                {children}
            </HStack>
        </Button>
    )
}