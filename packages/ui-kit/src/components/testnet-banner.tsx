'use client'

import { Box, chakra } from "@chakra-ui/react"
import { isTestnetChain } from "../constants/chain"
import { HIVE_GLOW_LAYOUT } from "../theme/hive-glow-tokens"

/**
 * The testnet ribbon (SurfTestnet): 28 px fixed to the bottom, dark red ground, a red
 * hairline on top, pale red caps after a dot. The header's TESTNET pill is the other half
 * of the same signal. Nothing on mainnet.
 */
export const TestnetBanner = () => {
    if (!isTestnetChain()) {
        return null
    }

    return (
        <Box
            role="status"
            data-testid="testnet-banner"
            position="fixed"
            bottom="0"
            left="0"
            right="0"
            h={`${HIVE_GLOW_LAYOUT.testnetRibbon}px`}
            display="flex"
            alignItems="center"
            justifyContent="center"
            gap="8px"
            bg="hg.testnet.ground"
            borderTopWidth="1px"
            borderColor="hg.testnet.line"
            color="hg.testnet.text"
            zIndex="banner"
            fontSize="11px"
            fontWeight="700"
            letterSpacing="0.14em"
        >
            <chakra.span aria-hidden boxSize="6px" borderRadius="full" bg="hg.testnet.dot" />
            YOU ARE ON TESTNET
        </Box>
    )
}
