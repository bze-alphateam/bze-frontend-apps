import { Link, Stack, type StackProps } from '@chakra-ui/react'
import NextLink from 'next/link'
import {useNavigation} from "@/hooks/useNavigation";
import {AppsMenu} from '@bze/bze-ui-kit'

interface NavbarLinksProps extends StackProps {
    onLinkClick?: () => void
}

// Define your navigation items with their routes
const navItems = [
    { name: 'Swap', href: '/' },
    { name: 'Exchange', href: '/exchange' },
    { name: 'Staking', href: '/staking' },
    { name: 'Pools', href: '/pools' },
    { name: 'Assets', href: '/assets' },
]

const navSubitems: { [key: string]: string } = {
    "/exchange/market": "/exchange",
    "/pools/details": "/pools",
}

export const NavbarLinks = ({ onLinkClick, ...props }: NavbarLinksProps) => {
    const {navigate, currentPathName} = useNavigation()

    const handleClick = (path: string) => {
        navigate(path)
        if (onLinkClick) onLinkClick()
    }

    return (
        <Stack direction={{ base: 'column', md: 'row' }} gap={{ base: '6', md: '8' }} {...props}>
            {navItems.map((item) => {
                const isActive = currentPathName === item.href || item.href === navSubitems[currentPathName]

                return (
                    <Link
                        onClick={() => handleClick(item.href)}
                        key={item.name}
                        as={NextLink}
                        href={item.href}
                        fontWeight="medium"
                        color={isActive ? 'colorPalette.fg' : 'fg.muted'}
                        textDecoration="none"
                        transition="color 0.2s"
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
                    </Link>
                )
            })}

            <AppsMenu onLinkClick={onLinkClick} />
        </Stack>
    )
}
