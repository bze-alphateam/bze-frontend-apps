'use client';

import {chakra} from '@chakra-ui/react';

export interface SegmentedProps<T extends string> {
    options: {value: T; label: string; testId?: string}[];
    value: T;
    onChange: (value: T) => void;
    label: string;
    testId?: string;
}

/**
 * The composer's segmented switch (Write / Preview, a SubDAO's three ways): an inset track of toggle
 * buttons, the pressed one raised. `aria-pressed` carries the state.
 */
export function Segmented<T extends string>({options, value, onChange, label, testId}: SegmentedProps<T>) {
    return (
        <chakra.div role="group" aria-label={label} display="inline-flex" flexWrap="wrap" alignSelf="flex-start" gap="2px" p="3px" borderRadius="12px" bg="hg.inset" borderWidth="1px" borderColor="hg.hairline" data-testid={testId}>
            {options.map((option) => {
                const pressed = option.value === value;
                return (
                    <chakra.button
                        key={option.value}
                        type="button"
                        aria-pressed={pressed}
                        onClick={() => onChange(option.value)}
                        h="32px"
                        px="14px"
                        border="0"
                        borderRadius="9px"
                        fontSize="13px"
                        fontWeight="600"
                        bg={pressed ? 'hg.raised' : 'transparent'}
                        color={pressed ? 'fg' : 'fg.muted'}
                        boxShadow={pressed ? '0 1px 2px rgba(0,0,0,0.3)' : 'none'}
                        cursor="pointer"
                        focusVisibleRing="outside"
                        _hover={pressed ? undefined : {color: 'fg'}}
                        data-testid={option.testId}
                    >
                        {option.label}
                    </chakra.button>
                );
            })}
        </chakra.div>
    );
}
