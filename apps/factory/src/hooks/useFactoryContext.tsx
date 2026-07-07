'use client';

import { useAssetsContext } from '@bze/bze-ui-kit';
import type { AssetsContextType } from '@/contexts/assets_context';

/**
 * Typed wrapper around useAssetsContext that returns the factory-specific context type.
 */
export function useFactoryContext(): AssetsContextType {
    return useAssetsContext() as AssetsContextType;
}
