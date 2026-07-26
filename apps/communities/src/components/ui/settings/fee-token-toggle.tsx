'use client';

import {Box, HStack, Separator, Switch, Text, VStack} from "@chakra-ui/react";
import {getChainNativeAssetDenom, TokenLogo, useAsset, useFeeTokens, useSettings} from "@bze/bze-ui-kit";

interface FeeTokenToggleProps {
    denom: string;
    accentColor?: string;
}

/**
 * "Use <TOKEN> for transaction fees" toggle for the token page's settings sidebar
 * (Features & Usage §7, Business Logic §4, §9). Shown only while the page token is
 * fee-eligible; hidden entirely otherwise.
 *
 * Enabling it sets the app-wide preferred fee denom to this token; disabling reverts to
 * BZE. The preference is persisted per app origin (localStorage) by the shared settings
 * layer, honoured by every transaction (useTx), and auto-reverts to BZE if the token
 * loses eligibility (useFeeTokens) — so we only need to drive updatePreferredFeeDenom here.
 */
export const FeeTokenToggle = ({denom, accentColor = "green"}: FeeTokenToggleProps) => {
    const {isValidFeeDenom, nativeDenom, isLoading} = useFeeTokens();
    const {asset} = useAsset(denom);
    const {feeDenom, updatePreferredFeeDenom} = useSettings();

    if (isLoading || !asset || denom === (nativeDenom ?? getChainNativeAssetDenom()) || !isValidFeeDenom(denom)) {
        return null;
    }

    const enabled = feeDenom === denom;

    return (
        <>
            <Box
                p="3"
                bgGradient="to-br"
                gradientFrom={`${accentColor}.500/10`}
                gradientTo={`${accentColor}.600/10`}
                borderWidth="1px"
                borderColor={`${accentColor}.500/25`}
                borderRadius="md"
            >
                <HStack justify="space-between" align="center" gap="3">
                    <HStack gap="2" align="center" minW={0}>
                        <Box width="20px" height="20px" flexShrink={0}>
                            <TokenLogo src={asset.logo} symbol={asset.ticker} circular={true}/>
                        </Box>
                        <VStack align="start" gap="0" minW={0}>
                            <Text fontSize="sm" fontWeight="medium">
                                Use {asset.ticker} for transaction fees
                            </Text>
                            <Text fontSize="xs" color="fg.muted">
                                Pay network fees in {asset.ticker} instead of BZE on this app.
                            </Text>
                        </VStack>
                    </HStack>
                    <Switch.Root
                        checked={enabled}
                        onCheckedChange={(details) =>
                            updatePreferredFeeDenom(details.checked ? denom : undefined)
                        }
                    >
                        <Switch.HiddenInput/>
                        <Switch.Control>
                            <Switch.Thumb/>
                        </Switch.Control>
                    </Switch.Root>
                </HStack>
            </Box>
            <Separator/>
        </>
    );
};
