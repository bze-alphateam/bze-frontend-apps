'use client';

import { useAssetsContext } from '@bze/bze-ui-kit';
import type { AssetsContextType } from '@/contexts/assets_context';

/**
 * Typed wrapper around useAssetsContext that returns the communities-specific context type.
 */
export function useCommunitiesContext(): AssetsContextType {
    return useAssetsContext() as AssetsContextType;
}
