import {chakra} from "@chakra-ui/react";

export type AprTone = 'success' | 'warning' | 'app';

/** A pool's APR keeps its old thresholds: green above 15 %, amber above 10 %, else the DEX colour. */
export const aprTone = (apr: number): AprTone => (apr > 15 ? 'success' : apr > 10 ? 'warning' : 'app');

const TONE_STYLE: Record<AprTone, { color: string; bg: string }> = {
    success: {color: 'hg.success.text', bg: 'hg.success/12'},
    warning: {color: 'hg.warning.text', bg: 'hg.warning/12'},
    app: {color: 'hg.link', bg: 'app.subtle'},
};

interface AprChipProps {
    /** The APR in percent. */
    apr: number;
    /** `lg` is the phone card's chip with its "APR" label. */
    size?: 'md' | 'lg';
}

export const AprChip = ({apr, size = 'md'}: AprChipProps) => {
    const tone = aprTone(apr);

    return (
        <chakra.span
            display="inline-flex"
            flexDirection={size === 'lg' ? 'column' : 'row'}
            alignItems="center"
            gap="2px"
            flex="none"
            px="10px"
            py={size === 'lg' ? '6px' : '4px'}
            borderRadius="8px"
            fontSize={size === 'lg' ? '15px' : '13px'}
            fontWeight="700"
            lineHeight="1.2"
            whiteSpace="nowrap"
            {...TONE_STYLE[tone]}
            data-testid="apr-chip"
            data-tone={tone}
        >
            {size === 'lg' && (
                <chakra.span fontSize="10px" fontWeight="700" letterSpacing="0.08em" color="hg.text.faint">APR</chakra.span>
            )}
            {apr.toFixed(2)}%
        </chakra.span>
    );
};
