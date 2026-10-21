"use client"

import React from 'react'
import NextLink from 'next/link'
import { Link } from '@chakra-ui/react'
import { LuInfo } from 'react-icons/lu'
import { chooseRewardsHref } from '@/lib/create-routes'

export interface RewardKindsLinkProps {
    /** The staked token, carried to the Choose screen so its buttons keep it. */
    denom?: string;
    /** Shows "Which one?" next to the icon. */
    withLabel?: boolean;
}

/**
 * ⓘ next to the word "reward": opens the Choose staking rewards screen, which compares the
 * simple and compounded reward (BFE-260, replaces the "Which reward fits?" modal).
 */
export function RewardKindsLink({ denom, withLabel = false }: RewardKindsLinkProps) {
    return (
        <Link
            asChild
            display="inline-flex"
            alignItems="center"
            gap="6px"
            minH={withLabel ? '32px' : '24px'}
            minW="24px"
            justifyContent="center"
            px={withLabel ? '10px' : '4px'}
            borderRadius="8px"
            color="hg.link"
            fontSize="13px"
            fontWeight="600"
            textDecoration="none"
            _hover={{ bg: 'hg.hoverFill', textDecoration: 'none' }}
            focusVisibleRing="outside"
            aria-label={withLabel ? undefined : 'Compare the kinds of reward'}
        >
            <NextLink href={chooseRewardsHref({ denom })}>
                <LuInfo aria-hidden />
                {withLabel && 'Which one?'}
            </NextLink>
        </Link>
    )
}
