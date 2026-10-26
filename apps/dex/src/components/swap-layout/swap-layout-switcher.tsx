'use client';

import { chakra, Flex, type FlexProps } from '@chakra-ui/react';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { applySwapLayout, DEFAULT_SWAP_LAYOUT, parseSwapLayout, type SwapLayout, type SwapLayoutStore } from './swap-layout';

const LayoutIcon = ({ children }: { children: ReactNode }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        {children}
    </svg>
);

const OPTIONS: { layout: SwapLayout; label: string; icon: ReactNode }[] = [
    {
        layout: 'aligned',
        label: 'Layout: aligned bands',
        icon: (
            <LayoutIcon>
                <rect x="3" y="4" width="10" height="9" rx="1.5" />
                <rect x="15" y="4" width="6" height="9" rx="1.5" />
                <rect x="3" y="16" width="18" height="4" rx="1.5" />
            </LayoutIcon>
        ),
    },
    {
        layout: 'centered',
        label: 'Layout: swap centre stage',
        icon: (
            <LayoutIcon>
                <rect x="7" y="3" width="10" height="11" rx="1.5" />
                <rect x="5" y="17" width="14" height="4" rx="1.5" />
            </LayoutIcon>
        ),
    },
    {
        layout: 'split',
        label: 'Layout: swap left, activity right',
        icon: (
            <LayoutIcon>
                <rect x="3" y="4" width="8" height="16" rx="1.5" />
                <rect x="13" y="4" width="8" height="5" rx="1.5" />
                <rect x="13" y="11" width="8" height="9" rx="1.5" />
            </LayoutIcon>
        ),
    },
];

// The store has no change events: only this switcher writes it, and it re-renders itself.
const noSubscription = () => () => {};
const serverLayout = () => DEFAULT_SWAP_LAYOUT;

export interface SwapLayoutSwitcherProps extends FlexProps {
    store: SwapLayoutStore;
}

/**
 * The desktop layout switcher of the swap page: three icon radios, faded until hovered or
 * focused. Picking one stores it and puts it on `<html>`, where the page's CSS reads it. The
 * server render (and the first client render) show B, so the stored value never breaks hydration.
 */
export function SwapLayoutSwitcher({ store, ...props }: SwapLayoutSwitcherProps) {
    const stored = useSyncExternalStore(noSubscription, () => parseSwapLayout(store.get()), serverLayout);
    const [picked, setPicked] = useState<SwapLayout | null>(null);
    const layout = picked ?? stored;

    const pick = (next: SwapLayout) => {
        store.set(next);
        applySwapLayout(next);
        setPicked(next);
    };

    return (
        <Flex
            role="radiogroup"
            aria-label="Swap page layout"
            hideBelow="lg"
            gap="2px"
            p="3px"
            borderRadius="hg.md"
            borderWidth="1px"
            borderColor="hg.divider"
            bg="hg.hoverFill/25"
            opacity={0.6}
            transitionProperty="opacity"
            transitionDuration="fast"
            _hover={{ opacity: 1 }}
            _focusWithin={{ opacity: 1 }}
            {...props}
        >
            {OPTIONS.map((option) => {
                const checked = option.layout === layout;
                return (
                    <chakra.button
                        key={option.layout}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        aria-label={option.label}
                        title={option.label}
                        onClick={() => pick(option.layout)}
                        display="inline-flex"
                        alignItems="center"
                        justifyContent="center"
                        w="38px"
                        h="32px"
                        p="0"
                        border="0"
                        borderRadius="9px"
                        cursor="pointer"
                        focusVisibleRing="inside"
                        {...(checked
                            ? { color: 'app.fg', bg: 'app.subtle' }
                            : { color: 'hg.text.faint', bg: 'transparent', _hover: { color: 'hg.text.secondary', bg: 'hg.hoverFill' } })}
                    >
                        {option.icon}
                    </chakra.button>
                );
            })}
        </Flex>
    );
}
