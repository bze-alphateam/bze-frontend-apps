import { createSkipProxyHandler } from '@bze/bze-ui-kit/server';

import { isCommunitiesEnabled } from '@/lib/app-gate';

// While the app is hidden behind the release gate (NEXT_PUBLIC_COMMUNITIES_ENABLED not `true`)
// the Skip proxy must not be reachable either — nothing should use our API key on a
// deployment that only serves the "under construction" page.
const notFound = () => new Response(null, { status: 404 });

export const { GET, POST } = isCommunitiesEnabled()
    ? createSkipProxyHandler()
    : { GET: notFound, POST: notFound };
