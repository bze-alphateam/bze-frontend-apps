'use client'

import {Box, type BoxProps, Button, chakra, Flex, IconButton} from '@chakra-ui/react';
import type {ReactNode} from 'react';
import {LuX} from 'react-icons/lu';

import type {NoticeStatus} from '../hive-glow/status';
import {IconTile} from '../hive-glow/cards';
import {hgVariant} from '../../theme/variants';

// The small pieces every drawer view shares (CompDrawerKit board): headings, the inset panel,
// key/value rows, quick-action buttons and the status tones.

/** The small-caps heading of a drawer section ("Balances", "Latest Buy", "Appearance"). */
export const DrawerSectionTitle = ({children}: { children: ReactNode }) => (
    <chakra.h4 m="0" fontSize="12px" letterSpacing="0.12em" textTransform="uppercase" fontWeight="700" color="hg.text.faint">
        {children}
    </chakra.h4>
);

interface DrawerViewHeaderProps {
    title: ReactNode;
    onClose?: () => void;
    closeLabel?: string;
    disabled?: boolean;
}

/** The title row of a view that replaces the balances (Send, Buy, Transaction Details…), with its close. */
export const DrawerViewHeader = ({title, onClose, closeLabel = 'Back to balances', disabled}: DrawerViewHeaderProps) => (
    <Flex justify="space-between" align="center">
        <chakra.h4 m="0" fontSize="16px" fontWeight="700" color="fg">{title}</chakra.h4>
        {onClose && (
            <IconButton aria-label={closeLabel} variant="ghost" size="sm" color="hg.text.muted" onClick={onClose} disabled={disabled}>
                <LuX/>
            </IconButton>
        )}
    </Flex>
);

/** The neutral inset panel: summaries, address card, info copy. */
export const DrawerInset = (props: BoxProps) => (
    <Box bg="hg.inset" borderRadius="14px" px="14px" py="12px" display="flex" flexDirection="column" gap="10px" {...props}/>
);

/** The route preview: the inset panel with a hairline edge. */
export const DrawerRoute = (props: BoxProps) => (
    <DrawerInset borderWidth="1px" borderColor="hg.hairline" gap="8px" {...props}/>
);

interface DrawerKVProps {
    label: ReactNode;
    children: ReactNode;
    /** Key size in px: 14 for the headline row of a route, 12 for its details, 13 otherwise. */
    size?: number;
}

/** A label on the left and its value on the right. */
export const DrawerKV = ({label, children, size = 13}: DrawerKVProps) => (
    <Flex justify="space-between" align="center" gap="12px" fontSize={`${size}px`}>
        <chakra.span color="hg.text.faint">{label}</chakra.span>
        <chakra.span textAlign="right" minW="0" color="fg">{children}</chakra.span>
    </Flex>
);

/** A number in the mono meta face. */
export const DrawerMono = ({children, size = 13, color = 'fg'}: { children: ReactNode; size?: number; color?: string }) => (
    <chakra.span fontFamily="mono" fontSize={`${size}px`} color={color} fontVariantNumeric="tabular-nums">{children}</chakra.span>
);

/** Muted helper copy under a field. */
export const DrawerHelper = ({children}: { children: ReactNode }) => (
    <chakra.span fontSize="12px" lineHeight="1.45" color="hg.text.faint">{children}</chakra.span>
);

interface DrawerQuickActionProps {
    icon: ReactNode;
    children: ReactNode;
    onClick: () => void;
    disabled?: boolean;
}

/** A quick action: the secondary button with a small gradient icon tile. */
export const DrawerQuickAction = ({icon, children, onClick, disabled}: DrawerQuickActionProps) => (
    <Button
        variant={hgVariant('secondary')}
        size="lg"
        flex="1"
        minW="0"
        px="10px"
        fontSize="13px"
        whiteSpace="nowrap"
        onClick={onClick}
        disabled={disabled}
    >
        <IconTile icon={icon} size={22}/>
        {children}
    </Button>
);

/** A row of a searchable pick list (networks, assets). */
export const DrawerPickList = (props: BoxProps) => (
    <Box maxH="200px" overflowY="auto" p="4px" borderRadius="12px" borderWidth="1px" borderColor="hg.hairline"
         display="flex" flexDirection="column" gap="2px" {...props}/>
);

interface DrawerPickRowProps {
    children: ReactNode;
    right?: ReactNode;
    onClick: () => void;
    disabled?: boolean;
}

export const DrawerPickRow = ({children, right, onClick, disabled}: DrawerPickRowProps) => (
    <chakra.button
        type="button"
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap="8px"
        minH="40px"
        px="12px"
        border="0"
        borderRadius="8px"
        bg="transparent"
        color="fg"
        fontSize="14px"
        fontWeight="500"
        textAlign="left"
        cursor={disabled ? 'not-allowed' : 'pointer'}
        opacity={disabled ? 0.5 : 1}
        _hover={disabled ? undefined : {bg: 'hg.hoverFill'}}
        focusVisibleRing="inside"
        onClick={onClick}
        disabled={disabled}
    >
        <Flex as="span" align="center" gap="8px" minW="0">{children}</Flex>
        {right}
    </chakra.button>
);

interface DrawerChosenRowProps {
    label: ReactNode;
    children: ReactNode;
    /** Shows "Change" on the right. */
    onChange?: () => void;
}

/** A chosen or fixed value shown as a read-only outlined row (source, destination, picked network). */
export const DrawerChosenRow = ({label, children, onChange}: DrawerChosenRowProps) => (
    <Flex direction="column" gap="6px">
        <chakra.span fontSize="13px" fontWeight="600" color="hg.text.secondary">{label}</chakra.span>
        <Flex align="center" justify="space-between" gap="8px" h="42px" pl="12px" pr={onChange ? '6px' : '12px'}
              borderRadius="12px" borderWidth="1px" borderColor="hg.hairline" fontSize="14px" color="fg">
            <Flex as="span" align="center" gap="8px" minW="0">{children}</Flex>
            {onChange && (
                <Button variant="ghost" size="sm" h="28px" color="hg.link" onClick={onChange}>Change</Button>
            )}
        </Flex>
    </Flex>
);

/** The shared status tone of a cross-chain tx state: blue in progress, green completed, red failed or abandoned. */
export const txStateTone = (state: string): NoticeStatus => {
    switch (state) {
        case 'completed': return 'success';
        case 'failed':
        case 'abandoned': return 'danger';
        default: return 'info';
    }
};
