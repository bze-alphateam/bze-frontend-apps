'use client'

import { useMyTokens } from '@/hooks/useMyTokens'
import { useStakingRewards } from '@/hooks/useStakingRewards'
import { useTokenSetup } from '@/hooks/useTokenSetup'
import { type Playbook, type PlaybookFacts, hasRunningLpCampaign } from '@/lib/playbooks'

/**
 * What a playbook's steps are detected from, for a chosen token: its setup checklist, its admin
 * and, for the LP playbook only, the running staking programs. Mount it only with a token.
 */
export function usePlaybookFacts(playbook: Playbook, denom: string): PlaybookFacts & { isLoading: boolean } {
    const { tokens } = useMyTokens()
    const admin = tokens.find(t => t.asset.denom === denom)?.admin
    const setup = useTokenSetup(denom, { admin })
    const needsPrograms = playbook.steps.some(s => s.goalId === 'campaign')
    const programs = useStakingRewards(needsPrograms)

    return {
        denom,
        items: setup.items,
        admin,
        lpDenom: setup.pools[0]?.lp_denom,
        lpCampaign: needsPrograms && hasRunningLpCampaign(programs.rewards, denom, setup.pools),
        isLoading: setup.isLoading || (needsPrograms && programs.isLoading),
    }
}
