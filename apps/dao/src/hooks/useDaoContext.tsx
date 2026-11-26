'use client';

import { useAssetsContext } from '@bze/bze-ui-kit';
import type { AssetsContextType } from '@/contexts/assets_context';

/** Typed wrapper around useAssetsContext that returns the DAO app's context type. */
export function useDaoContext(): AssetsContextType {
    return useAssetsContext() as AssetsContextType;
}
