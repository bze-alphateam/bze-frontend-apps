'use client'

import { useCallback, useMemo } from 'react'
import {
    TxKind,
    TxKindSpec,
    TxOptions,
    canAffordTx,
    prettyAmount,
    uAmountToBigNumberAmount,
    useAssets,
    useBalances,
    useBZETx,
    useGasFeeEstimator,
    useToast,
} from '@bze/bze-ui-kit'

type BzeTx = ReturnType<typeof useBZETx>['tx']

/** Message type URL → gas-estimate kind for every message the factory sends. */
const TYPE_URL_KINDS: Record<string, TxKind> = {
    '/bze.tokenfactory.MsgCreateDenom': 'create-denom',
    '/bze.tokenfactory.MsgMint': 'mint',
    '/bze.tokenfactory.MsgBurn': 'burn-tokens',
    '/bze.tokenfactory.MsgSetDenomMetadata': 'set-denom-metadata',
    '/bze.tokenfactory.MsgChangeAdmin': 'change-admin',
    '/bze.tokenfactory.MsgSetDenomBranding': 'set-denom-branding',
    '/bze.tradebin.MsgCreateMarket': 'create-market',
    '/bze.tradebin.MsgCreateLiquidityPool': 'create-pool',
    '/bze.tradebin.MsgAddLiquidity': 'add-liquidity',
    '/bze.rewards.MsgCreateStakingReward': 'create-staking-reward',
    '/bze.rewards.MsgCreateTradingReward': 'create-trading-reward',
    '/bze.rewards.MsgUpdateStakingReward': 'update-staking-reward',
    '/bze.rewards.MsgDeleteStakingReward': 'delete-staking-reward',
    '/bze.rewards.MsgCreateDenomReward': 'create-denom-reward',
    '/bze.rewards.MsgCreateDenomRewardSchedule': 'create-denom-reward-schedule',
    '/bze.rewards.MsgUpdateDenomRewardSchedule': 'update-denom-reward-schedule',
    '/bze.rewards.MsgDistributeDenomRewards': 'distribute-denom-rewards',
    '/bze.burner.MsgStartRaffle': 'start-raffle',
}

/**
 * The gas-estimate kinds of a message list, in order. Unknown type URLs are skipped, so an
 * unmapped message simply gets no pre-flight check (the wallet still simulates at signing).
 */
export function txKindsOf(msgs: ReadonlyArray<{ typeUrl: string; value?: unknown }>): Array<TxKind | TxKindSpec> {
    return msgs.flatMap((msg): Array<TxKind | TxKindSpec> => {
        // A multi-send's gas grows with its outputs.
        if (msg.typeUrl === '/cosmos.bank.v1beta1.MsgMultiSend') {
            const outputs = (msg.value as { outputs?: unknown[] } | undefined)?.outputs
            return [{ kind: 'multi-send', count: outputs?.length ?? 1 }]
        }
        const kind = TYPE_URL_KINDS[msg.typeUrl]
        return kind ? [kind] : []
    })
}

/**
 * The factory's tx layer: `useBZETx` plus a pre-flight gas check shared by every form. Before
 * the wallet opens, the gas fee of the exact message list is estimated (ui-kit's gas engine)
 * and compared with the wallet balance of the fee denom; a short balance toasts a clear reason
 * and resolves `false` instead of letting the ante handler reject the transaction.
 */
export function useFactoryTx() {
    const { tx: bzeTx, progressTrack } = useBZETx()
    const { estimate: estimateGasFee } = useGasFeeEstimator()
    const { getBalanceByDenom } = useBalances()
    const { denomTicker, denomDecimals } = useAssets()
    const { toast } = useToast()

    const tx: BzeTx = useCallback(
        async (msgs: Parameters<BzeTx>[0], options?: TxOptions) => {
            const kinds = txKindsOf(msgs)
            if (kinds.length > 0) {
                const gasFee = estimateGasFee(kinds)
                const check = canAffordTx({ gasFee, balanceOf: denom => getBalanceByDenom(denom).amount })
                if (!check.canAfford) {
                    const feeDisplay = uAmountToBigNumberAmount(gasFee.amount, denomDecimals(gasFee.denom))
                    toast.error(
                        'Not enough for the network fee',
                        `This transaction needs ≈ ${prettyAmount(feeDisplay)} ${denomTicker(gasFee.denom)} for gas.`,
                    )
                    return false
                }
            }
            return bzeTx(msgs, options)
        },
        [bzeTx, estimateGasFee, getBalanceByDenom, denomDecimals, denomTicker, toast]
    )

    return useMemo(() => ({ tx, progressTrack }), [tx, progressTrack])
}
