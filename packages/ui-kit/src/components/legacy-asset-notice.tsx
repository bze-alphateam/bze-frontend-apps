'use client'

import {Box, HStack, Link, VStack} from '@chakra-ui/react';
import {LuInfo, LuExternalLink} from 'react-icons/lu';
import type {LegacyAssetNotice} from '../constants/assets';

interface LegacyAssetNoticeBoxProps {
    notice: LegacyAssetNotice;
}

/**
 * Small info box explaining that an asset is being wound down (see
 * `LEGACY_ASSET_NOTICES` / `getLegacyAssetNotice`). Same layout as the apps'
 * InfoBox, in amber so it reads as a heads-up rather than a tip.
 */
export const LegacyAssetNoticeBox = ({notice}: LegacyAssetNoticeBoxProps) => {
    return (
        <Box
            p={3}
            borderRadius="lg"
            bg="orange.500/10"
            borderWidth="1px"
            borderColor="orange.500/25"
            role="note"
        >
            <HStack align="start" gap={2.5}>
                <Box color="orange.500" mt={0.5} flexShrink={0}>
                    <LuInfo size={16}/>
                </Box>
                <VStack align="start" gap={0.5}>
                    <Box fontSize="sm" fontWeight="semibold">
                        {notice.title}
                    </Box>
                    <Box fontSize="sm" color="fg.muted">
                        {notice.text}
                    </Box>
                    {notice.url && (
                        <Link
                            href={notice.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            fontSize="sm"
                            color="orange.500"
                        >
                            Learn more <LuExternalLink size={12}/>
                        </Link>
                    )}
                </VStack>
            </HStack>
        </Box>
    );
};
