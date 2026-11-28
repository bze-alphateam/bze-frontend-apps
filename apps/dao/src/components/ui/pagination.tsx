'use client';

import {chakra, Flex} from '@chakra-ui/react';
import type {ReactNode} from 'react';
import {LuChevronLeft, LuChevronRight} from 'react-icons/lu';
import {pageItems} from '@/lib/pagination';

const BUTTON = {
    type: 'button' as const,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontWeight: '600',
    fontVariantNumeric: 'tabular-nums',
    focusVisibleRing: 'outside' as const,
    _disabled: {cursor: 'not-allowed', color: 'hg.text.disabled', borderColor: 'hg.divider', bg: 'transparent'},
};

const Arrow = ({direction, size, disabled, onClick}: {direction: 'prev' | 'next'; size: number; disabled: boolean; onClick: () => void}) => (
    <chakra.button
        {...BUTTON}
        aria-label={direction === 'prev' ? 'Previous page' : 'Next page'}
        disabled={disabled}
        onClick={onClick}
        boxSize={`${size}px`}
        borderRadius={size > 36 ? '12px' : '10px'}
        borderWidth="1px"
        {...(size > 36
            ? {borderColor: 'hg.lineStrong', color: 'fg', bg: 'hg.secondaryFill'}
            : {borderColor: 'hg.hairline', color: 'hg.text.secondary', bg: 'transparent'})}
        _hover={disabled ? undefined : {borderColor: 'app.border', bg: 'hg.inset'}}
    >
        {direction === 'prev' ? <LuChevronLeft size={size > 36 ? 18 : 16} /> : <LuChevronRight size={size > 36 ? 18 : 16} />}
    </chakra.button>
);

const Step = ({direction, size, disabled, onClick}: {direction: 'prev' | 'next'; size: number; disabled: boolean; onClick: () => void}) => (
    <chakra.button
        {...BUTTON}
        aria-label={direction === 'prev' ? 'Previous page' : 'Next page'}
        disabled={disabled}
        onClick={onClick}
        h={`${size}px`}
        px="14px"
        gap="4px"
        fontSize="13px"
        borderRadius={size > 36 ? '12px' : '10px'}
        borderWidth="1px"
        borderColor="hg.hairline"
        color="fg"
        bg="transparent"
        _hover={disabled ? undefined : {borderColor: 'app.border', bg: 'hg.inset'}}
    >
        {direction === 'prev' && <LuChevronLeft size={16} aria-hidden />}
        {direction === 'prev' ? 'Prev' : 'Next'}
        {direction === 'next' && <LuChevronRight size={16} aria-hidden />}
    </chakra.button>
);

interface FooterProps {
    /** The count line ("1–20 of 24 DAOs", "Page 2"). */
    count: ReactNode;
    /** The pager is hidden, the count stays (everything fits on one page). */
    hidePager?: boolean;
    testId?: string;
    children: (size: 'desktop' | 'phone') => ReactNode;
}

/**
 * The footer under a list: on desktop the count on the left and the pager on the right; on a
 * phone the pager (44 px buttons) with the count centred under it. Both are in the page and the
 * breakpoint shows one of them.
 */
const Footer = ({count, hidePager, testId, children}: FooterProps) => (
    <Flex direction="column" gap="10px" data-testid={testId}>
        {!hidePager && (
            <Flex display={{base: 'flex', md: 'none'}} justify="center" data-testid="pager-phone">{children('phone')}</Flex>
        )}
        <Flex justify={{base: 'center', md: 'space-between'}} align="center" gap="12px" wrap="wrap">
            <chakra.span fontSize="12px" lineHeight="1.5" color="hg.text.faint" data-testid="list-count">{count}</chakra.span>
            {!hidePager && (
                <Flex display={{base: 'none', md: 'flex'}} data-testid="pager-desktop">{children('desktop')}</Flex>
            )}
        </Flex>
    </Flex>
);

export interface PaginationProps {
    /** The page shown (1-based). */
    page: number;
    /** How many pages there are. The pager is hidden with one page or none. */
    pages: number;
    onPage: (page: number) => void;
    count: ReactNode;
    /** Leave the buttons dead while the page is loading. */
    busy?: boolean;
}

/** Numbered pages: ‹ 1 2 3 4 › on desktop, ‹ Page 2 of 4 › on a phone, the count line beside / under it. */
export const Pagination = ({page, pages, onPage, count, busy}: PaginationProps) => (
    <Footer count={count} hidePager={pages <= 1} testId="pagination">
        {(size) => {
            const px = size === 'phone' ? 44 : 36;
            const prevOff = busy || page <= 1;
            const nextOff = busy || page >= pages;
            return size === 'phone' ? (
                <Flex as="nav" aria-label="Pages" display="grid" gridTemplateColumns="44px 1fr 44px" alignItems="center" gap="8px" w="100%">
                    <Arrow direction="prev" size={px} disabled={prevOff} onClick={() => onPage(page - 1)} />
                    <chakra.span textAlign="center" fontSize="14px" fontWeight="600" color="hg.text.secondary" fontVariantNumeric="tabular-nums">{`Page ${page} of ${pages}`}</chakra.span>
                    <Arrow direction="next" size={px} disabled={nextOff} onClick={() => onPage(page + 1)} />
                </Flex>
            ) : (
                <Flex as="nav" aria-label="Pages" align="center" gap="4px" fontSize="13px">
                    <Arrow direction="prev" size={px} disabled={prevOff} onClick={() => onPage(page - 1)} />
                    {pageItems(page, pages).map((item, i) => item === 'gap' ? (
                        <chakra.span key={`gap-${i}`} aria-hidden px="4px" color="fg.subtle">…</chakra.span>
                    ) : (
                        <chakra.button
                            key={item}
                            {...BUTTON}
                            disabled={busy}
                            aria-current={item === page ? 'page' : undefined}
                            aria-label={`Page ${item}`}
                            onClick={() => item !== page && onPage(item)}
                            minW="36px"
                            h="36px"
                            px="10px"
                            borderRadius="10px"
                            {...(item === page
                                ? {bgImage: 'appButton', color: 'white', borderWidth: '0'}
                                : {borderWidth: '1px', borderColor: 'hg.hairline', color: 'hg.text.secondary', bg: 'transparent', _hover: {borderColor: 'app.border', bg: 'hg.inset', color: 'fg'}})}
                        >
                            {item}
                        </chakra.button>
                    ))}
                    <Arrow direction="next" size={px} disabled={nextOff} onClick={() => onPage(page + 1)} />
                </Flex>
            );
        }}
    </Footer>
);

export interface PrevNextProps {
    hasPrev: boolean;
    hasNext: boolean;
    onPrev: () => void;
    onNext: () => void;
    count: ReactNode;
    busy?: boolean;
}

/** A list without a total: ‹ Prev · Next ›, and the count line ("Page 2"). Hidden together with the count only when there is nowhere to go. */
export const PrevNext = ({hasPrev, hasNext, onPrev, onNext, count, busy}: PrevNextProps) => (
    <Footer count={count} hidePager={!hasPrev && !hasNext && !busy} testId="prev-next">
        {(size) => {
            const px = size === 'phone' ? 44 : 36;
            return (
                <Flex as="nav" aria-label="Pages" align="center" justify={size === 'phone' ? 'space-between' : 'flex-end'} gap="8px" w={size === 'phone' ? '100%' : undefined}>
                    <Step direction="prev" size={px} disabled={busy || !hasPrev} onClick={onPrev} />
                    <Step direction="next" size={px} disabled={busy || !hasNext} onClick={onNext} />
                </Flex>
            );
        }}
    </Footer>
);
