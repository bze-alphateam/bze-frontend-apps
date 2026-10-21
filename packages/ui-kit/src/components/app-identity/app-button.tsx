'use client';

import { IconButton, Link } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { LuExternalLink } from 'react-icons/lu';

import { appAccentColor, type AppKey } from '../../constants/app-identity';
import { AppIcon } from './app-icon';

export interface AppLinkProps {
    /** The BZE app the link opens. */
    app: AppKey;
    href: string;
    /** The app's name: "Explorer", "DEX", "Burner"… */
    children: ReactNode;
    /**
     * The link starts a line under left-aligned text: its padding moves into the margin so the
     * icon lines up with the text's edge, while the hover fill keeps its size.
     */
    flush?: boolean;
}

/**
 * The one way to point at another BZE app: a ghost link (no border, no fill)
 * with the app's icon, its name in the app's accent and an external-link mark,
 * opening in a new tab. It stays quiet next to the page's own actions.
 */
export const AppLink = ({ app, href, children, flush }: AppLinkProps) => (
    <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        color={appAccentColor(app)}
        fontSize="sm"
        fontWeight="medium"
        lineHeight="1.25rem"
        display="inline-flex"
        alignItems="center"
        gap="1.5"
        px="1.5"
        py="1"
        ms={flush ? '-1.5' : undefined}
        borderRadius="md"
        verticalAlign="middle"
        whiteSpace="nowrap"
        textDecoration="none"
        _hover={{ bg: 'bg.subtle', textDecoration: 'none' }}
        data-testid="app-link"
        data-app={app}
    >
        <AppIcon app={app} size={16} />
        {children}
        <LuExternalLink aria-hidden size={12} />
    </Link>
);

export interface AppIconButtonProps {
    app: AppKey;
    href: string;
    /** What the link opens, e.g. "View on Explorer": the only name it has. */
    'aria-label': string;
    size?: 'xs' | 'sm' | 'md';
}

/** The icon-only AppLink, for rows with no room for a label (tx lists, hashes). */
export const AppIconButton = ({ app, href, 'aria-label': label, size = 'sm' }: AppIconButtonProps) => (
    <IconButton
        asChild
        variant="ghost"
        size={size}
        _hover={{ bg: 'bg.subtle' }}
        aria-label={label}
        title={label}
        data-testid="app-icon-button"
        data-app={app}
    >
        <a href={href} target="_blank" rel="noopener noreferrer">
            <AppIcon app={app} size={size === 'md' ? 18 : 16} />
        </a>
    </IconButton>
);
