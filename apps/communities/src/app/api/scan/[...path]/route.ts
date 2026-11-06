import {isCommunitiesEnabled} from '@/lib/app-gate';
import {createScanProxyHandler} from '@/lib/token-activity/scan-proxy';

// Token Activity reads BZE Scan through this route (Scan sends no CORS headers for the app).
// Hidden behind the release gate like the Skip proxy.
const notFound = () => new Response(null, {status: 404});

export const {GET} = isCommunitiesEnabled()
    ? createScanProxyHandler({baseUrl: process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://explorer.getbze.com'})
    : {GET: notFound};
