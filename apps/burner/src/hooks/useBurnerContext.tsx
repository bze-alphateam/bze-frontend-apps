'use client';

import { useAssetsContext } from '@bze/bze-ui-kit';
import type { AssetsContextType } from '@/contexts/assets_context';

/**
 * Typed wrapper around useAssetsContext that returns the burner-specific context type.
 * Use this when you need burner-specific fields (lockBalance, nextBurn, raffles, etc.)
 */
export function useBurnerContext(): AssetsContextType {
    return useAssetsContext() as AssetsContextType;
}
