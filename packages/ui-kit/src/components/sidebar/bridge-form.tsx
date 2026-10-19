'use client'

import {useState} from 'react';
import {Button, VStack} from '@chakra-ui/react';
import {LuExternalLink} from 'react-icons/lu';
import type {TransferDirection} from '../../types/cross_chain';
import {DepositForm} from './deposit-form';
import {WithdrawForm} from './withdraw-form';
import {openExternalLink} from '../../utils/functions';
import {SegmentedTabs} from '../hive-glow/status';
import {hgVariant} from '../../theme/variants';
import {DrawerViewHeader} from './drawer-kit';

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
    const [direction, setDirection] = useState<TransferDirection>('deposit');

    return (
        <VStack gap="14px" align="stretch">
            <DrawerViewHeader title="Deposit / Withdraw" onClose={onClose}/>

            <SegmentedTabs<TransferDirection>
                aria-label="Direction"
                value={direction}
                onChange={setDirection}
                options={[{value: 'deposit', label: 'Deposit'}, {value: 'withdraw', label: 'Withdraw'}]}
            />

            {/* Sub-form — each direction is self-contained */}
            {direction === 'deposit' && <DepositForm/>}
            {direction === 'withdraw' && <WithdrawForm/>}

            {/* External Skip.go bridge — for routes outside our IBC counterparties */}
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
        </VStack>
    );
};
