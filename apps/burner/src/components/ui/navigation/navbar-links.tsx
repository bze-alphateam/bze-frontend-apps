import {Link, Stack, type StackProps} from '@chakra-ui/react'
import NextLink from 'next/link'
import {useNavigation} from "@/hooks/useNavigation";
import { useState } from 'react';
import { SearchCoinModal } from '@/components/search-coin-modal';
import {AppsMenu} from '@bze/bze-ui-kit'

interface NavbarLinksProps extends StackProps {
    onLinkClick?: () => void
}

// Define your navigation items with their routes
const navItems = [
    { name: 'Home', href: '/' },
    { name: 'Raffles', href: '/raffles' },
    { name: 'Search Coin', href: '#', isModal: true },
]

const navSubitems: { [key: string]: string } = {}

export const NavbarLinks = ({ onLinkClick, ...props }: NavbarLinksProps) => {
    const {navigate, currentPathName} = useNavigation()
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)

    const handleClick = (item: typeof navItems[0]) => {
        if (item.isModal) {
            setIsSearchModalOpen(true)
            if (onLinkClick) onLinkClick()
        } else {
            navigate(item.href)
            if (onLinkClick) onLinkClick()
        }
    }

    return (
        <>
            <Stack direction={{ base: 'column', md: 'row' }} gap={{ base: '6', md: '8' }} {...props}>
                {navItems.map((item) => {
                    const isActive = !item.isModal && (currentPathName === item.href || item.href === navSubitems[currentPathName])

                    return (
                        <Link
                            onClick={() => handleClick(item)}
                            key={item.name}
                            as={item.isModal ? 'button' : NextLink}
                            href={item.isModal ? undefined : item.href}
                            fontWeight="medium"
                            color={isActive ? 'colorPalette.fg' : 'fg.muted'}
                            textDecoration="none"
                            transition="color 0.2s"
                            cursor="pointer"
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

            {/* Search Coin Modal */}
            <SearchCoinModal
                isOpen={isSearchModalOpen}
                onClose={() => setIsSearchModalOpen(false)}
            />
        </>
    )
}
