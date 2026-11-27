import {createScanProxyHandler} from '@/lib/scan-proxy';

export const {GET} = createScanProxyHandler({baseUrl: process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://explorer.getbze.com'});
