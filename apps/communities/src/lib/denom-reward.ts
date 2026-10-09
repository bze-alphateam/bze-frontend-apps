import type {EcosystemApp} from "@bze/bze-ui-kit";

/**
 * The Factory page where the team of `denom` can create its denom reward, or `undefined` when the
 * Factory is not part of this deployment's ecosystem (excluded or disabled). `apps` is the result
 * of ui-kit's `getEcosystemApps()`.
 */
export function factoryDenomRewardLink(denom: string, apps: EcosystemApp[]): string | undefined {
    const factory = apps.find(app => app.key === 'factory');
    if (!factory || factory.disabled || !factory.href) return undefined;

    return `${factory.href.replace(/\/+$/, '')}/manage/token?denom=${encodeURIComponent(denom)}`;
}
