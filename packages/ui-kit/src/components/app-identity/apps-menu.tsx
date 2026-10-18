'use client';

import { Box, Link, Menu, Portal, Stack, Text } from '@chakra-ui/react';

import { ECOSYSTEM_MENU_LABEL, getEcosystemApps, type EcosystemApp } from '../../constants/ecosystem';
import { AppIcon } from './app-icon';

export interface AppsMenuProps {
    /** Called when an entry is clicked, e.g. to close the mobile popover. */
    onLinkClick?: () => void;
    /** The entries; defaults to getEcosystemApps() (the app itself is excluded by its env). */
    apps?: EcosystemApp[];
}

const ICON_SIZE = 20;

const ComingSoon = () => (
    <Text as="span" fontSize="xs" color="fg.muted">
        (coming soon)
    </Text>
);

/**
 * The navbar's "Apps" menu: the other BZE apps with their icons, each opening
 * in a new tab. Inline list below `md` (inside the mobile popover), a dropdown
 * from `md` up.
 */
export const AppsMenu = ({ onLinkClick, apps }: AppsMenuProps) => {
    const items = apps ?? getEcosystemApps();
    if (items.length === 0) return null;

    return (
        <>
            {/* Mobile: inline list */}
            <Box hideFrom="md" data-testid="apps-menu-mobile">
                <Text fontWeight="medium" color="fg.muted" fontSize="sm" mb="1">
                    {ECOSYSTEM_MENU_LABEL}
                </Text>
                <Stack direction="column" gap="0" pl="4">
                    {items.map((item) =>
                        item.disabled ? (
                            <Text
                                key={item.key}
                                fontWeight="medium"
                                color="fg.muted"
                                opacity={0.5}
                                display="flex"
                                alignItems="center"
                                gap="2.5"
                                minH="44px"
                                data-app={item.key}
                            >
                                <AppIcon app={item.key} size={ICON_SIZE} />
                                {item.name} <ComingSoon />
                            </Text>
                        ) : (
                            <Link
                                key={item.key}
                                href={item.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                fontWeight="medium"
                                color="fg.muted"
                                textDecoration="none"
                                transition="color 0.2s"
                                onClick={onLinkClick}
                                display="flex"
                                alignItems="center"
                                gap="2.5"
                                minH="44px"
                                data-app={item.key}
                                _hover={{ color: 'colorPalette.fg', textDecoration: 'none' }}
                            >
                                <AppIcon app={item.key} size={ICON_SIZE} />
                                {item.name}
                            </Link>
                        ),
                    )}
                </Stack>
            </Box>

            {/* Desktop: dropdown */}
            <Box hideBelow="md">
                <Menu.Root>
                    <Menu.Trigger asChild>
                        <Text
                            as="button"
                            fontWeight="medium"
                            color="fg.muted"
                            cursor="pointer"
                            transition="color 0.2s"
                            _hover={{ color: 'colorPalette.fg' }}
                            _focus={{ outline: 'none', boxShadow: 'none' }}
                            _focusVisible={{ outline: '2px solid', outlineColor: 'colorPalette.500', outlineOffset: '2px' }}
                        >
                            {ECOSYSTEM_MENU_LABEL}
                        </Text>
                    </Menu.Trigger>
                    <Portal>
                        <Menu.Positioner>
                            <Menu.Content minW="44">
                                {items.map((item) => (
                                    <Menu.Item
                                        key={item.key}
                                        value={item.key}
                                        disabled={item.disabled}
                                        asChild={!item.disabled}
                                        minH="44px"
                                    >
                                        {item.disabled ? (
                                            <Text display="flex" alignItems="center" gap="2.5" data-app={item.key}>
                                                <AppIcon app={item.key} size={ICON_SIZE} />
                                                {item.name} <ComingSoon />
                                            </Text>
                                        ) : (
                                            <Link
                                                href={item.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                textDecoration="none"
                                                color="inherit"
                                                display="flex"
                                                alignItems="center"
                                                gap="2.5"
                                                width="100%"
                                                onClick={onLinkClick}
                                                data-app={item.key}
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
