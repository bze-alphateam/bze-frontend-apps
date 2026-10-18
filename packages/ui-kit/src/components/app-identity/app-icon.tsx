'use client';

import { Box, chakra, Image } from '@chakra-ui/react';
import { useId } from 'react';

import type { AppKey } from '../../constants/app-identity';
import { APP_ICON_DATA } from './icon-data';

/** The main BZ mark the Website entry uses; every app ships it in public/images. */
const WEBSITE_MARK = '/images/bze_alternative_512x512.png';

/** At this size and below the small cut is used (thicker ring, fewer details). */
const SMALL_CUT_MAX = 32;

export interface AppIconProps {
    app: AppKey;
    /** Width and height in px. 32 and below use the small cut. */
    size: number;
}

/**
 * The icon of a BZE app. Decorative: the label next to it names the link.
 *
 * The frame (disc, ring, glyph placement) is the one every icon.svg and
 * icon-small.svg of the branding repo shares; the glyph path and gradient stops
 * come from icon-data.ts. The light and dark files differ only in the disc
 * colour, which switches in CSS, so there is no flash on a dark page.
 */
export const AppIcon = ({ app, size }: AppIconProps) => {
    // Gradient ids must be unique: several icons share one document.
    const uid = `bze-app-icon-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

    if (app === 'website') {
        return (
            <Image
                src={WEBSITE_MARK}
                alt=""
                aria-hidden
                boxSize={`${size}px`}
                flexShrink={0}
                data-testid="app-icon"
                data-app={app}
            />
        );
    }

    const data = APP_ICON_DATA[app];
    const small = size <= SMALL_CUT_MAX;
    const ring = `${uid}-r`;
    const glyph = `${uid}-g`;

    return (
        <Box
            as="span"
            display="inline-flex"
            boxSize={`${size}px`}
            flexShrink={0}
            aria-hidden
            data-testid="app-icon"
            data-app={app}
            data-cut={small ? 'small' : 'full'}
        >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={size} height={size} focusable="false">
                <defs>
                    <linearGradient id={ring} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor={data.from} />
                        <stop offset="1" stopColor={data.to} />
                    </linearGradient>
                    <linearGradient id={glyph} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor={data.from} />
                        <stop offset="1" stopColor={data.to} />
                    </linearGradient>
                </defs>
                <chakra.circle cx="256" cy="256" r="256" fill={{ base: '#0F1318', _dark: '#1B2128' }} />
                {small ? (
                    <circle cx="256" cy="256" r="241" fill="none" stroke={`url(#${ring})`} strokeWidth="28" />
                ) : (
                    <circle cx="256" cy="256" r="248" fill="none" stroke={`url(#${ring})`} strokeWidth="14" />
                )}
                <g
                    transform={
                        small
                            ? 'translate(45.14 0) skewX(-10) translate(256 256) scale(0.96) translate(-256 -256)'
                            : 'translate(45.14 0) skewX(-10)'
                    }
                >
                    <path d={small ? data.small : data.full} fill={`url(#${glyph})`} fillRule="evenodd" />
                </g>
            </svg>
        </Box>
    );
};
