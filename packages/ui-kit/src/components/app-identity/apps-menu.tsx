'use client';

import { Box, chakra, Link, Menu, Portal, Stack, type SystemStyleObject, Text } from '@chakra-ui/react';

import { ECOSYSTEM_MENU_LABEL, getEcosystemApps, type EcosystemApp } from '../../constants/ecosystem';
import type { BrandedAppKey } from '../../constants/app-identity';
import { navItemStyle } from '../hive-glow/nav-item';
import { AppIcon } from './app-icon';
import { APP_ICON_DATA } from './icon-data';

export interface AppsMenuProps {
    /** Called when an entry is clicked, e.g. to close the mobile popover. */
    onLinkClick?: () => void;
    /** The entries; defaults to getEcosystemApps() (the app itself is excluded by its env). */
    apps?: EcosystemApp[];
}

/** The small cut, 20 px in the dropdown (SurfAppsMenu) and 24 px in the phone menu (PhoneNav). */
const ICON_SIZE = 20;
const PHONE_ICON_SIZE = 24;

const ComingSoon = () => (
    <Text as="span" fontSize="12px" color="hg.text.faint">
        (coming soon)
    </Text>
);

/** Hover and keyboard focus outline an item in that app's on-dark colour (the website stays neutral). */
const accentOf = (app: EcosystemApp['key']) =>
    app === 'website' ? null : APP_ICON_DATA[app as BrandedAppKey]?.from ?? null;

const highlightStyle = (app: EcosystemApp['key']): SystemStyleObject => {
    const accent = accentOf(app);
    return accent
        ? {
              color: 'fg',
              fontWeight: '600',
              bg: `color-mix(in srgb, ${accent} 8%, transparent)`,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 55%, transparent)`,
          }
        : { color: 'fg', fontWeight: '600', bg: 'hg.hoverFill', boxShadow: 'inset 0 0 0 1px var(--chakra-colors-hg-line-strong)' };
};

/**
 * The header's "Apps" menu: the other BZE apps with their icons, each opening in a new tab.
 * Inline list below `md` (inside the phone menu), a dropdown from `md` up.
 */
export const AppsMenu = ({ onLinkClick, apps }: AppsMenuProps) => {
    const items = apps ?? getEcosystemApps();
    if (items.length === 0) return null;

    const phoneRow: SystemStyleObject = {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minH: '48px',
        px: '16px',
        borderRadius: '12px',
        fontSize: '16px',
        fontWeight: '500',
        color: 'hg.text.secondary',
        textDecoration: 'none',
    };

    return (
        <>
            {/* Phone: inline list */}
            <Box hideFrom="md" data-testid="apps-menu-mobile">
                <Text
                    px="16px"
                    pb="6px"
                    fontSize="12px"
                    letterSpacing="0.14em"
                    textTransform="uppercase"
                    fontWeight="700"
                    color="hg.text.faint"
                >
                    {ECOSYSTEM_MENU_LABEL}
                </Text>
                <Stack direction="column" gap="0">
                    {items.map((item) =>
                        item.disabled ? (
                            <Text key={item.key} css={phoneRow} opacity={0.5} data-app={item.key}>
                                <AppIcon app={item.key} size={PHONE_ICON_SIZE} />
                                {item.name} <ComingSoon />
                            </Text>
                        ) : (
                            <Link
                                key={item.key}
                                href={item.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={onLinkClick}
                                data-app={item.key}
                                css={phoneRow}
                                _hover={highlightStyle(item.key)}
                                _focusVisible={highlightStyle(item.key)}
                            >
                                <AppIcon app={item.key} size={PHONE_ICON_SIZE} />
                                {item.name}
                            </Link>
                        ),
                    )}
                </Stack>
            </Box>

            {/* Desktop: dropdown */}
            <Box hideBelow="md">
                <Menu.Root positioning={{ placement: 'bottom-end', offset: { mainAxis: 8 } }}>
                    <Menu.Trigger asChild>
                        <chakra.button type="button" css={navItemStyle}>
                            {ECOSYSTEM_MENU_LABEL}
                        </chakra.button>
                    </Menu.Trigger>
                    <Portal>
                        <Menu.Positioner>
                            <Menu.Content
                                minW="240px"
                                p="6px"
                                bg="hg.card"
                                borderWidth="1px"
                                borderColor="hg.hairline"
                                borderRadius="14px"
                                boxShadow="hg.popover"
                                display="flex"
                                flexDirection="column"
                                gap="2px"
                            >
                                {items.map((item) => (
                                    <Menu.Item
                                        key={item.key}
                                        value={item.key}
                                        disabled={item.disabled}
                                        asChild={!item.disabled}
                                        minH="44px"
                                        px="10px"
                                        gap="10px"
                                        borderRadius="10px"
                                        fontSize="14px"
                                        fontWeight="500"
                                        color="hg.text.secondary"
                                        _highlighted={highlightStyle(item.key)}
                                    >
                                        {item.disabled ? (
                                            <Text display="flex" alignItems="center" gap="10px" data-app={item.key}>
                                                <AppIcon app={item.key} size={ICON_SIZE} />
                                                {item.name} <ComingSoon />
                                            </Text>
                                        ) : (
                                            <Link
                                                href={item.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                textDecoration="none"
                                                display="flex"
                                                alignItems="center"
                                                gap="10px"
                                                width="100%"
                                                onClick={onLinkClick}
                                                data-app={item.key}
                                                _hover={{ textDecoration: 'none' }}
                                            >
                                                <AppIcon app={item.key} size={ICON_SIZE} />
                                                {item.name}
                                            </Link>
                                        )}
                                    </Menu.Item>
                                ))}
                            </Menu.Content>
                        </Menu.Positioner>
                    </Portal>
                </Menu.Root>
            </Box>
        </>
    );
};
