'use client';

import {type ComponentProps, type ReactNode} from 'react';
import {chakra, Flex} from '@chakra-ui/react';

// Small form parts of the Create-DAO flow, drawn in the host app's colours (the `app` palette).

export const Field = ({label, hint, error, children}: {label: string; hint?: ReactNode; error?: string; children: ReactNode}) => (
    <chakra.label display="flex" flexDirection="column" gap="6px" fontSize="14px" fontWeight="600" minW="0">
        {label}
        {children}
        {error
            ? <chakra.span fontSize="12px" fontWeight="400" color="hg.danger" role="alert">{error}</chakra.span>
            : hint && <chakra.span fontSize="12px" fontWeight="400" color="hg.text.faint">{hint}</chakra.span>}
    </chakra.label>
);

const inputProps = {
    bg: 'hg.inset',
    borderWidth: '1px',
    borderColor: 'hg.hairline',
    borderRadius: 'hg.md',
    color: 'fg',
    px: '12px',
    fontSize: '15px',
    fontWeight: '500',
    minW: '0',
    outline: 'none',
    _focusVisible: {borderColor: 'app.border'},
    _disabled: {opacity: 0.6},
} as const;

export const TextInput = (props: ComponentProps<typeof chakra.input>) => (
    <chakra.input h="44px" {...inputProps} {...props} />
);

export const TextArea = (props: ComponentProps<typeof chakra.textarea>) => (
    <chakra.textarea py="10px" lineHeight="1.5" resize="vertical" {...inputProps} {...props} />
);

export const Select = (props: ComponentProps<typeof chakra.select>) => (
    <chakra.select h="44px" {...inputProps} {...props} />
);

/** A radio or checkbox drawn as a card; the native input stays in the tab order. */
export const Choice = ({
    type, name, checked, disabled, onChange, title, badge, children, testId,
}: {
    type: 'radio' | 'checkbox';
    name?: string;
    checked: boolean;
    disabled?: boolean;
    onChange: (checked: boolean) => void;
    title: ReactNode;
    badge?: ReactNode;
    children?: ReactNode;
    testId?: string;
}) => (
    <chakra.label
        display="flex"
        gap="12px"
        alignItems="flex-start"
        p="14px 16px"
        borderRadius="hg.md"
        borderWidth="1px"
        borderColor={checked ? 'app.border' : 'hg.hairline'}
        bg={checked ? 'app.subtle' : 'hg.card'}
        opacity={disabled ? 0.6 : 1}
        cursor={disabled ? 'not-allowed' : 'pointer'}
        data-testid={testId}
        data-checked={checked ? '' : undefined}
    >
        <chakra.input
            type={type}
            name={name}
            checked={checked}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            accentColor="var(--chakra-colors-app-solid)"
            mt="3px"
            flex="none"
        />
        <Flex direction="column" gap="3px" flex="1" minW="0">
            <Flex justify="space-between" gap="12px" wrap="wrap">
                <chakra.strong fontSize="15px">{title}</chakra.strong>
                {badge && <chakra.span fontSize="13px" color="fg.muted">{badge}</chakra.span>}
            </Flex>
            {children && <chakra.span fontSize="13px" lineHeight="1.5" color="fg.muted">{children}</chakra.span>}
        </Flex>
    </chakra.label>
);

export const ChoiceNote = ({tone = 'muted', children}: {tone?: 'muted' | 'warning'; children: ReactNode}) => (
    <chakra.span fontSize="12px" color={tone === 'warning' ? 'hg.warning' : 'fg.muted'}>{children}</chakra.span>
);
