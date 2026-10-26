'use client'

import {Box, Link} from '@chakra-ui/react';
import {LuExternalLink} from 'react-icons/lu';
import type {LegacyAssetNotice} from '../constants/assets';
import {Notice} from './hive-glow/status';

interface LegacyAssetNoticeBoxProps {
    notice: LegacyAssetNotice;
}

/**
 * Small notice explaining that an asset is being wound down (see `LEGACY_ASSET_NOTICES` /
 * `getLegacyAssetNotice`). The warning notice (SurfNotices): shared amber, so it never reads
 * as the Burner orange.
 */
export const LegacyAssetNoticeBox = ({notice}: LegacyAssetNoticeBoxProps) => {
    return (
        <Notice status="warning" title={notice.title}>
            {notice.text}
            {notice.url && (
                <Box as="span" display="block" mt="4px">
                    <Link
                        href={notice.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        color="hg.warning.text"
                        fontWeight="600"
                    >
                        Learn more <LuExternalLink size={12}/>
                    </Link>
                </Box>
            )}
        </Notice>
    );
};
