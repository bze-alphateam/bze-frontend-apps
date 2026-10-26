'use client'

import {useState} from 'react';
import {Button, Text, VStack} from '@chakra-ui/react';
import {LuExternalLink} from 'react-icons/lu';
import type {TransferDirection} from '../../types/cross_chain';
import {DepositForm} from './deposit-form';
import {WithdrawForm} from './withdraw-form';
import {openExternalLink} from '../../utils/functions';
import {SegmentedTabs} from '../hive-glow/status';
import {hgVariant} from '../../theme/variants';
import {DrawerViewHeader} from './drawer-kit';
import {useBridgeAvailability} from '../../hooks/useBridgeAvailability';

const SKIP_GO_URL = 'https://go.skip.build/?dest_chain=beezee-1&dest_asset=ubze';

interface BridgeFormProps {
    onClose?: () => void;
}

/**
 * Top-level bridge form. Renders a direction toggle and delegates to the
 * deposit or withdraw sub-form. Each sub-form is self-contained: its own
 * hooks, pickers, balance logic, wallet connect, and execute button.
 */
export const BridgeForm = ({onClose}: BridgeFormProps) => {
    const [picked, setPicked] = useState<TransferDirection>('deposit');
    const {canDeposit, canWithdraw, canUseSkip, isLoading} = useBridgeAvailability();

    // Only the directions that have something to offer; both while the lists load.
    const directions: TransferDirection[] = isLoading
        ? ['deposit', 'withdraw']
        : [...(canDeposit ? ['deposit' as const] : []), ...(canWithdraw ? ['withdraw' as const] : [])];
    const direction = directions.includes(picked) ? picked : directions[0];
    const title = directions.length === 1 ? (direction === 'deposit' ? 'Deposit' : 'Withdraw') : 'Deposit / Withdraw';

    return (
        <VStack gap="14px" align="stretch">
            <DrawerViewHeader title={title} onClose={onClose}/>

            {directions.length > 1 && (
                <SegmentedTabs<TransferDirection>
                    aria-label="Direction"
                    value={direction}
                    onChange={setPicked}
                    options={[{value: 'deposit', label: 'Deposit'}, {value: 'withdraw', label: 'Withdraw'}]}
                />
            )}

            {/* Sub-form — each direction is self-contained */}
            {direction === 'deposit' && <DepositForm/>}
            {direction === 'withdraw' && <WithdrawForm/>}

            {directions.length === 0 && (
                <Text fontSize="14px" color="fg.muted" data-testid="bridge-skip-only">
                    BeeZee has no direct route for your assets right now. Skip.go can still bring coins in from other networks.
                </Text>
            )}

            {/* External Skip.go bridge — for routes outside our IBC counterparties (mainnet only) */}
            {canUseSkip && (
                <Button
                    size="md"
                    variant={hgVariant('secondary')}
                    color="hg.link"
                    borderColor="app.border"
                    onClick={() => openExternalLink(SKIP_GO_URL)}
                >
                    Use Skip.go
                    <LuExternalLink size="12"/>
                </Button>
            )}
        </VStack>
    );
};
