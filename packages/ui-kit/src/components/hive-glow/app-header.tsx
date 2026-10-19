'use client';

import {
    Box,
    Button,
    chakra,
    ClientOnly,
    Flex,
    Icon,
    IconButton,
    Image,
    Link,
    Popover,
    Portal,
    Skeleton,
    type SystemStyleObject,
    VisuallyHidden,
} from '@chakra-ui/react';
import { type ElementType, type ReactNode, useState } from 'react';
import { LuMenu, LuWallet, LuX } from 'react-icons/lu';

import { isTestnetChain } from '../../constants/chain';
import type { EcosystemApp } from '../../constants/ecosystem';
import { HIVE_GLOW_LAYOUT } from '../../theme/hive-glow-tokens';
import type { HiveGlowAppKey } from '../../theme/hive-glow-tokens';
import { hgVariant } from '../../theme/variants';
import { AppsMenu } from '../app-identity/apps-menu';
import { Sidebar } from '../sidebar/sidebar';
import { PageContainer } from './layout';
import { navItemStyle } from './nav-item';

export interface AppHeaderBadge {
    /** Shown in the gradient pill; nothing is drawn at 0. */
    count: number;
    /** What the number means, for assistive tech ("2 proposals need your vote"). */
    label: string;
    /** A visible caption next to the pill in the phone menu ("need your vote"). */
    caption?: string;
}

export interface AppHeaderNavItem {
    label: string;
    /** The route. An item without one is a button, e.g. Burner's "Search Coin". */
    href?: string;
    /** The current page; the app owns the rule. */
    active?: boolean;
    onClick?: () => void;
    badge?: AppHeaderBadge;
}

export interface AppHeaderProps {
    /** Picks the lockup files every app ships in public/images (app-landscape-*.svg, app-compact-*.svg). */
    app: HiveGlowAppKey;
    /** The app's name, the lockup's alt text ("BeeZee DEX"). */
    appName: string;
    /** The app's nav, in order; the Apps menu always comes last. */
    items: AppHeaderNavItem[];
    /** "Connect" without a wallet, the native balance with one ("1.2K TBZE"). */
    walletLabel: string;
    /** The wallet drawer's content. */
    walletContent: ReactNode;
    /** The settings trigger (SettingsToggle). */
    settings: ReactNode;
    /** The router's link component (next/link); a plain anchor otherwise. */
    linkAs?: ElementType;
    /** The Apps menu entries; defaults to getEcosystemApps(). */
    apps?: EcosystemApp[];
}

const LOCKUP = {
    landscape: { h: '36px', files: ['app-landscape-light.svg', 'app-landscape-dark.svg'] },
    compact: { h: '30px', files: ['app-compact-light.svg', 'app-compact-dark.svg'] },
} as const;

/**
 * The app's lockup in both colour modes; CSS shows the one for the current mode, so the
 * server render and the first client render are the same and nothing flashes.
 * "light"/"dark" in a file name is the background it is drawn for.
 */
const Lockup = ({ kind, alt }: { kind: keyof typeof LOCKUP; alt: string }) => {
    const { h, files } = LOCKUP[kind];
    return (
        <>
            <Image src={`/images/${files[0]}`} alt={alt} h={h} w="auto" display="block" _dark={{ display: 'none' }} data-lockup={kind} />
            <Image src={`/images/${files[1]}`} alt={alt} h={h} w="auto" display="none" _dark={{ display: 'block' }} data-lockup={kind} />
        </>
    );
};

const TestnetPill = () => (
    <chakra.span
        data-testid="testnet-pill"
        flex="none"
        fontSize={{ base: '10px', md: '11px' }}
        fontWeight="700"
        letterSpacing={{ base: '0.1em', md: '0.12em' }}
        px={{ base: '6px', md: '8px' }}
        py={{ base: '3px', md: '4px' }}
        borderRadius="full"
        color="hg.testnet.text"
        bg="hg.testnet.pillFill"
        borderWidth="1px"
        borderColor="hg.testnet.pillLine"
    >
        TESTNET
    </chakra.span>
);

const BadgePill = ({ badge, phone }: { badge: AppHeaderBadge; phone?: boolean }) => (
    <chakra.span
        aria-label={badge.label}
        data-testid="nav-badge"
        minW={phone ? '22px' : '18px'}
        h={phone ? '22px' : '18px'}
        px={phone ? '6px' : '5px'}
        borderRadius="full"
        display="inline-flex"
        alignItems="center"
        justifyContent="center"
        fontSize={phone ? '12px' : '11px'}
        fontWeight="700"
        color="hg.buttonText"
        bgImage="appButton"
    >
        {badge.count}
    </chakra.span>
);

const hasBadge = (item: AppHeaderNavItem) => (item.badge?.count ?? 0) > 0;

/** The gradient underline of the active desktop item. */
const activeUnderline: SystemStyleObject = {
    _after: {
        content: '""',
        position: 'absolute',
        left: '14px',
        right: '14px',
        bottom: '3px',
        h: '2px',
        borderRadius: '2px',
        bgImage: 'app',
    },
};

const phoneItemStyle: SystemStyleObject = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    w: '100%',
    minH: '52px',
    px: '16px',
    borderRadius: '14px',
    borderWidth: '1px',
    borderColor: 'transparent',
    fontSize: '17px',
    fontWeight: '500',
    color: 'hg.text.secondary',
    bg: 'transparent',
    textAlign: 'start',
    textDecoration: 'none',
    cursor: 'pointer',
    _hover: { color: 'fg', textDecoration: 'none' },
    _focusVisible: { outline: '2px solid', outlineColor: 'app.focusRing', outlineOffset: '2px' },
    _currentPage: { color: 'fg', fontWeight: '600', bg: 'hg.card', borderColor: 'app.500/35' },
};

interface NavEntryProps {
    item: AppHeaderNavItem;
    linkAs?: ElementType;
    phone?: boolean;
    onNavigate?: () => void;
}

/** One nav item: a link to its route, or a button when it has none. */
const NavEntry = ({ item, linkAs, phone, onNavigate }: NavEntryProps) => {
    const css = phone ? phoneItemStyle : { ...navItemStyle, ...(item.active ? activeUnderline : {}) };
    const onClick = () => {
        item.onClick?.();
        onNavigate?.();
    };
    const content = (
        <>
            {item.label}
            {phone ? (
                item.active ? (
                    <chakra.span aria-hidden boxSize="8px" borderRadius="full" bgImage="app" />
                ) : (
                    hasBadge(item) && (
                        <chakra.span display="inline-flex" alignItems="center" gap="8px">
                            {item.badge?.caption && (
                                <chakra.span aria-hidden fontSize="13px" color="fg.muted">
                                    {item.badge.caption}
                                </chakra.span>
                            )}
                            <BadgePill badge={item.badge!} phone />
                        </chakra.span>
                    )
                )
            ) : (
                hasBadge(item) && <BadgePill badge={item.badge!} />
            )}
        </>
    );

    if (!item.href) {
        return (
            <chakra.button type="button" css={css} onClick={onClick}>
                {content}
            </chakra.button>
        );
    }

    return (
        <Link
            as={linkAs}
            href={item.href}
            aria-current={item.active ? 'page' : undefined}
            css={css}
            onClick={onClick}
        >
            {content}
        </Link>
    );
};

interface PhoneMenuProps {
    items: AppHeaderNavItem[];
    linkAs?: ElementType;
    apps?: EcosystemApp[];
}

/** The hamburger and the PhoneNav sheet: the nav items, then the Apps list. */
const PhoneMenu = ({ items, linkAs, apps }: PhoneMenuProps) => {
    const [open, setOpen] = useState(false);
    const close = () => setOpen(false);
    // A dot on the closed button while a badge waits inside the menu.
    const dot = items.some(hasBadge);

    return (
        <Popover.Root
            open={open}
            onOpenChange={(e) => setOpen(e.open)}
            positioning={{ placement: 'bottom', overflowPadding: 0, offset: { mainAxis: 12 } }}
        >
            <Popover.Trigger asChild>
                <IconButton
                    aria-label={open ? 'Close menu' : 'Open menu'}
                    variant={hgVariant('secondary')}
                    size="md"
                    color={open ? 'fg' : 'hg.text.secondary'}
                    hideFrom="md"
                    position="relative"
                >
                    <Icon boxSize="18px">{open ? <LuX /> : <LuMenu />}</Icon>
                    {dot && !open && (
                        <Box
                            data-testid="menu-badge-dot"
                            aria-hidden
                            position="absolute"
                            top="6px"
                            right="6px"
                            boxSize="9px"
                            borderRadius="full"
                            bgImage="app"
                            boxShadow="0 0 0 2px var(--chakra-colors-hg-ground)"
                        />
                    )}
                </IconButton>
            </Popover.Trigger>
            <Portal>
                <Popover.Positioner>
                    <Popover.Content
                        aria-label="Menu"
                        boxShadow="none"
                        borderRadius="none"
                        maxW="unset"
                        width="var(--available-width)"
                        height="var(--available-height)"
                        bg="hg.ground"
                        px="16px"
                        pt="16px"
                        pb="24px"
                        overflowY="auto"
                    >
                        <chakra.nav aria-label="Main" display="flex" flexDirection="column" gap="4px">
                            {items.map((item) => (
                                <NavEntry key={item.label} item={item} linkAs={linkAs} phone onNavigate={close} />
                            ))}
                            <Box h="1px" bg="hg.hairline" my="14px" mx="4px" />
                            <AppsMenu onLinkClick={close} apps={apps} />
                        </chakra.nav>
                    </Popover.Content>
                </Popover.Positioner>
            </Portal>
        </Popover.Root>
    );
};

const triggerFallback = <Skeleton w="10" h="10" borderRadius="hg.md" />;

/**
 * The shared app header (Header, PhoneHeader and PhoneNav boards): the app's lockup and the
 * TESTNET pill, the app's nav with the Apps menu last, the wallet and settings triggers.
 * Sticky on a translucent, blurred ground. Everything app-specific comes in through props.
 */
export const AppHeader = ({ app, appName, items, walletLabel, walletContent, settings, linkAs, apps }: AppHeaderProps) => {
    const testnet = isTestnetChain();

    return (
        <chakra.header
            data-testid="app-header"
            data-app={app}
            position="sticky"
            top="0"
            zIndex="sticky"
            bg="hg.header"
            backdropFilter="blur(12px)"
            borderBottomWidth="1px"
            borderColor="hg.divider"
        >
            <PageContainer>
                <Flex
                    h={{ base: `${HIVE_GLOW_LAYOUT.headerPhone}px`, md: `${HIVE_GLOW_LAYOUT.header}px` }}
                    align="center"
                    justify="space-between"
                    gap={{ base: '8px', md: '24px' }}
                >
                    <Flex align="center" gap={{ base: '8px', md: '12px' }} minW={{ base: '0', lg: '220px' }}>
                        <Link as={linkAs} href="/" flex="none" _focusVisible={{ outline: '2px solid', outlineColor: 'app.focusRing' }}>
                            <Box hideBelow="md">
                                <Lockup kind="landscape" alt={appName} />
                            </Box>
                            <Box hideFrom="md">
                                <Lockup kind="compact" alt={appName} />
                            </Box>
                        </Link>
                        {testnet && <TestnetPill />}
                    </Flex>

                    <chakra.nav aria-label="Main" hideBelow="md" display="flex" alignItems="center" gap="4px">
                        {items.map((item) => (
                            <NavEntry key={item.label} item={item} linkAs={linkAs} />
                        ))}
                        <AppsMenu apps={apps} />
                    </chakra.nav>

                    <Flex align="center" gap={{ base: '6px', md: '10px' }} flex="none" minW={{ lg: '220px' }} justify="flex-end">
                        <ClientOnly fallback={triggerFallback}>
                            <Sidebar
                                ariaLabel="Wallet"
                                trigger={
                                    <Button
                                        data-wallet-trigger
                                        variant={hgVariant('primary')}
                                        size="md"
                                        px={{ base: '0', md: '16px' }}
                                        minW={{ base: '44px', md: 'auto' }}
                                        borderRadius="hg.md"
                                        gap="8px"
                                    >
                                        <LuWallet />
                                        <chakra.span hideBelow="md">{walletLabel}</chakra.span>
                                        <VisuallyHidden hideFrom="md">Wallet</VisuallyHidden>
                                    </Button>
                                }
                            >
                                {walletContent}
                            </Sidebar>
                        </ClientOnly>
                        <ClientOnly fallback={triggerFallback}>{settings}</ClientOnly>
                        <PhoneMenu items={items} linkAs={linkAs} apps={apps} />
                    </Flex>
                </Flex>
            </PageContainer>
        </chakra.header>
    );
};
