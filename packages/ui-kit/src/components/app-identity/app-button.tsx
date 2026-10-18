'use client';

import { Button, IconButton, Link } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { LuExternalLink } from 'react-icons/lu';

import { appAccentColor, type AppKey } from '../../constants/app-identity';
import { AppIcon } from './app-icon';

export interface AppButtonProps {
    /** The BZE app the button opens. */
    app: AppKey;
    href: string;
    /** The label: "View on Explorer", "Trade on DEX", "View transaction"… */
    children: ReactNode;
    /** `sm` inside cards and table rows. */
    size?: 'sm' | 'md';
    /** Stretch to the container's width (stacked dialog actions). */
    fullWidth?: boolean;
}

/**
 * An action that opens another BZE app, in a new tab. Outlined in the app's
 * accent, never filled: the app icon is drawn for the page background and
 * fades on a coloured fill.
 */
export const AppButton = ({ app, href, children, size = 'md', fullWidth = false }: AppButtonProps) => {
    const accent = appAccentColor(app);
    return (
        <Button
            asChild
            variant="outline"
            size={size}
            w={fullWidth ? 'full' : undefined}
            color={accent}
            borderColor={accent}
            _hover={{ bg: 'bg.muted' }}
            data-testid="app-button"
            data-app={app}
        >
            <a href={href} target="_blank" rel="noopener noreferrer">
                <AppIcon app={app} size={size === 'sm' ? 16 : 18} />
                {children}
                <LuExternalLink aria-hidden />
            </a>
        </Button>
    );
};

export interface AppIconButtonProps {
    app: AppKey;
    href: string;
    /** What the button does, e.g. "View on Explorer": the only name it has. */
    'aria-label': string;
    size?: 'xs' | 'sm' | 'md';
}

/** The icon-only AppButton, for layouts with no room for a label (list rows). */
export const AppIconButton = ({ app, href, 'aria-label': label, size = 'sm' }: AppIconButtonProps) => {
    const accent = appAccentColor(app);
    return (
        <IconButton
            asChild
            variant="outline"
            size={size}
            borderColor={accent}
            _hover={{ bg: 'bg.muted' }}
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
};

export interface AppLinkProps {
    app: AppKey;
    href: string;
    children: ReactNode;
}

/**
 * Another BZE app named inside a sentence or a link list: the small icon in
 * front of the text, both in the app's accent, opening in a new tab.
 */
export const AppLink = ({ app, href, children }: AppLinkProps) => (
    <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        color={appAccentColor(app)}
        fontWeight="medium"
        display="inline-flex"
        alignItems="center"
        gap="1.5"
        verticalAlign="middle"
        data-testid="app-link"
        data-app={app}
    >
        <AppIcon app={app} size={16} />
        {children}
    </Link>
);
