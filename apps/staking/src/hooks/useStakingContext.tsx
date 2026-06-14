'use client';

import { useAssetsContext } from '@bze/bze-ui-kit';
import type { AssetsContextType } from '@/contexts/assets_context';

/**
 * Typed wrapper around useAssetsContext that returns the staking-specific context type.
 */
export function useStakingContext(): AssetsContextType {
    return useAssetsContext() as AssetsContextType;
}
