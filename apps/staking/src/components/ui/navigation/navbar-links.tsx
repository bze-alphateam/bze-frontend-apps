import {Text, Box, Link, Stack, type StackProps, Menu, Portal} from '@chakra-ui/react'
import NextLink from 'next/link'
import {useNavigation} from "@/hooks/useNavigation";
import {getEcosystemApps} from '@bze/bze-ui-kit'
import {useOpenProposalsSummary} from "@/hooks/useOpenProposalsSummary";
import {badgeCount, badgeLabel, GOVERNANCE_HREF} from "@/lib/governance/summary";

interface NavbarLinksProps extends StackProps {
    onLinkClick?: () => void
}

// Define your navigation items with their routes
const navItems = [
    { name: 'Dashboard', href: '/' },
    { name: 'Governance', href: GOVERNANCE_HREF },
]

const navSubitems: { [key: string]: string } = {}

// An item is active on its own path and, except for the root, on every path below it
// (Governance stays active on /governance/<id>).
const isItemActive = (href: string, pathname: string | null) => {
    if (!pathname) return false
    if (pathname === href || href === navSubitems[pathname]) return true
    return href !== '/' && pathname.startsWith(`${href}/`)
}

// The open proposals that need the wallet's vote (all open ones without a
// wallet), as a small purple pill; nothing at 0 or while the summary is
// missing. In the phone menu a caption says what the number means.
const GovernanceBadge = () => {
    const {summary} = useOpenProposalsSummary()
    const count = badgeCount(summary)
    if (!summary || count === 0) return null

    return (
        <>
            <Box
                as="span"
                aria-label={badgeLabel(summary, count)}
                minW="20px"
                h="20px"
                px="1.5"
                borderRadius="full"
                bg="purple.solid"
                color="white"
                fontSize="xs"
                fontWeight="bold"
                display="inline-flex"
                alignItems="center"
                justifyContent="center"
            >
                {count}
            </Box>
            <Text as="span" aria-hidden hideFrom="md" fontSize="13px" color="fg.muted">
                {summary.connected ? (count === 1 ? 'needs your vote' : 'need your vote') : 'open'}
            </Text>
        </>
    )
}

export const NavbarLinks = ({ onLinkClick, ...props }: NavbarLinksProps) => {
    const {navigate, currentPathName} = useNavigation()
    const appsItems = getEcosystemApps()

    const handleClick = (item: typeof navItems[0]) => {
        navigate(item.href)
        if (onLinkClick) onLinkClick()
    }

    return (
        <>
            <Stack direction={{ base: 'column', md: 'row' }} gap={{ base: '6', md: '8' }} {...props}>
                {navItems.map((item) => {
                    const isActive = isItemActive(item.href, currentPathName)

                    return (
                        <Link
                            onClick={() => handleClick(item)}
                            key={item.name}
                            as={NextLink}
                            href={item.href}
                            aria-current={isActive ? 'page' : undefined}
                            fontWeight="medium"
                            color={isActive ? 'colorPalette.fg' : 'fg.muted'}
                            textDecoration="none"
                            transition="color 0.2s"
                            cursor="pointer"
                            display="inline-flex"
                            alignItems="center"
                            gap="2"
                            _hover={{
                                color: 'colorPalette.fg',
                                textDecoration: 'none',
                            }}
                            _focus={{
                                outline: 'none',
                                boxShadow: 'none',
                            }}
                            _focusVisible={{
                                outline: '2px solid',
                                outlineColor: 'colorPalette.500',
                                outlineOffset: '2px',
                            }}
                        >
                            {item.name}
                            {item.href === GOVERNANCE_HREF && <GovernanceBadge />}
                        </Link>
                    )
                })}

                {/* Other Items - Mobile: Inline, Desktop: Dropdown */}

                {/* Mobile: Show items inline */}
                {appsItems.length > 0 && <Box hideFrom="md">
                    <Text
                        fontWeight="medium"
                        color="fg.muted"
                        fontSize="sm"
                        mb="3"
                    >
                        Other
                    </Text>
                    <Stack direction="column" gap="4" pl="4">
                        {appsItems.map((item) => {
                            const Icon = item.icon
                            return item.disabled ? (
                                <Text
                                    key={item.name}
                                    fontWeight="medium"
                                    color="fg.muted"
                                    opacity={0.5}
                                    display="flex"
                                    alignItems="center"
                                    gap="2"
                                >
                                    <Icon size={16} />
                                    {item.name} <Text as="span" fontSize="xs">(coming soon)</Text>
                                </Text>
                            ) : (
                                <Link
                                    key={item.name}
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
                                    gap="2"
                                    _hover={{
                                        color: 'colorPalette.fg',
                                        textDecoration: 'none',
                                    }}
                                >
                                    <Icon size={16} />
                                    {item.name}
                                </Link>
                            )
                        })}
                    </Stack>
                </Box>}

                {/* Desktop: Show as dropdown menu */}
                {appsItems.length > 0 && <Box hideBelow="md">
                    <Menu.Root>
                        <Menu.Trigger asChild>
                            <Text
                                as="button"
                                fontWeight="medium"
                                color="fg.muted"
                                cursor="pointer"
                                transition="color 0.2s"
                                _hover={{
                                    color: 'colorPalette.fg',
                                }}
                                _focus={{
                                    outline: 'none',
                                    boxShadow: 'none',
                                }}
                            >
                                Other
                            </Text>
                        </Menu.Trigger>
                        <Portal>
                            <Menu.Positioner>
                                <Menu.Content>
                                    {appsItems.map((item) => {
                                        const Icon = item.icon
                                        return (
                                            <Menu.Item
                                                key={item.name}
                                                value={item.name}
                                                disabled={item.disabled}
                                                asChild={!item.disabled}
                                            >
                                                {item.disabled ? (
                                                    <Text display="flex" alignItems="center" gap="2">
                                                        <Icon size={16} />
                                                        {item.name} <Text as="span" fontSize="xs" color="fg.muted">(coming soon)</Text>
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
                                                        gap="2"
                                                        width="100%"
                                                        onClick={onLinkClick}
                                                    >
                                                        <Icon size={16} />
                                                        {item.name}
                                                    </Link>
                                                )}
                                            </Menu.Item>
                                        )
                                    })}
                                </Menu.Content>
                            </Menu.Positioner>
                        </Portal>
                    </Menu.Root>
                </Box>}
            </Stack>
        </>
    )
}
