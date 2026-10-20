import {Badge, Box, Button, chakra, Flex, Input, Skeleton} from "@chakra-ui/react";
import type BigNumber from "bignumber.js";
import {hgVariant, MaxInputGroup, sanitizeNumberInput, Tooltip} from "@bze/bze-ui-kit";
import {LuInfo, LuSettings} from "react-icons/lu";
import {type ComponentProps, type ReactNode, useId} from "react";

// The pieces of the pool page's three forms (add, remove, boost) and its overview tiles.

interface AmountFieldProps {
    label: string;
    available: ReactNode;
    value: string;
    onChange: (value: string) => void;
    onMax: () => void;
    disabled?: boolean;
    maxDisabled?: boolean;
}

/** A labelled amount with its available balance, Max inside the field like every other amount. */
export const AmountField = ({label, available, value, onChange, onMax, disabled, maxDisabled}: AmountFieldProps) => {
    const id = useId();

    return (
        <Flex direction="column" gap="6px" w="full">
            <Flex justify="space-between" gap="12px" fontSize="13px">
                <chakra.label htmlFor={id} color="hg.text.secondary">{label}</chakra.label>
                <chakra.span color="hg.text.faint">Available: {available}</chakra.span>
            </Flex>
            <MaxInputGroup onMax={onMax} maxDisabled={maxDisabled ?? disabled}>
                <Input
                    id={id}
                    placeholder="0.0"
                    value={value}
                    onChange={(e) => onChange(sanitizeNumberInput(e.target.value))}
                    h="46px"
                    borderRadius="12px"
                    bg="hg.inset"
                    fontSize="16px"
                    fontWeight="600"
                    inputMode="decimal"
                    autoComplete="off"
                    disabled={disabled}
                />
            </MaxInputGroup>
        </Flex>
    );
};

/** A preset chip: the gradient when picked, a hairline outline otherwise. */
export const PresetChip = ({active, onClick, disabled, h = '28px', children}: {
    active: boolean;
    onClick: () => void;
    disabled?: boolean;
    h?: string;
    children: ReactNode;
}) => (
    <chakra.button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        disabled={disabled}
        h={h}
        px="10px"
        borderRadius="8px"
        borderWidth={active ? '0' : '1px'}
        borderColor="hg.lineStrong"
        bgImage={active ? 'app' : undefined}
        bg={active ? undefined : 'transparent'}
        color={active ? 'hg.buttonText' : 'hg.text.secondary'}
        fontSize="12px"
        fontWeight={active ? '700' : '600'}
        cursor="pointer"
        focusVisibleRing="outside"
        _hover={active ? undefined : {bg: 'hg.hoverFill'}}
        _disabled={{opacity: 0.5, cursor: 'not-allowed'}}
    >
        {children}
    </chakra.button>
);

interface SlippageRowProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    open: boolean;
    onToggle: () => void;
    disabled?: boolean;
}

/** The slippage line of a summary, with its gear, presets, custom field and high-slippage warning. */
export const SlippageRow = ({label, value, onChange, open, onToggle, disabled}: SlippageRowProps) => (
    <>
        <Flex justify="space-between" align="center">
            <Flex as="span" align="center" gap="6px" color="hg.text.muted">
                {label}
                <chakra.button
                    type="button"
                    aria-label="Edit slippage"
                    aria-expanded={open}
                    onClick={onToggle}
                    disabled={disabled}
                    boxSize="28px"
                    display="inline-flex"
                    alignItems="center"
                    justifyContent="center"
                    border="0"
                    borderRadius="8px"
                    bg="transparent"
                    color="hg.text.muted"
                    cursor="pointer"
                    focusVisibleRing="outside"
                    _hover={{bg: 'hg.hoverFill', color: 'fg'}}
                >
                    <LuSettings size={14} aria-hidden="true"/>
                </chakra.button>
            </Flex>
            <chakra.strong>{value}%</chakra.strong>
        </Flex>

        {open && (
            <Flex direction="column" gap="8px">
                <Flex gap="6px" align="center" wrap="wrap">
                    {['0.5', '1', '3'].map((preset) => (
                        <PresetChip key={preset} active={value === preset} onClick={() => onChange(preset)} disabled={disabled}>
                            {preset}%
                        </PresetChip>
                    ))}
                    <Input
                        aria-label="Custom slippage"
                        placeholder="Custom"
                        value={value}
                        onChange={(e) => onChange(sanitizeNumberInput(e.target.value))}
                        w="70px"
                        h="28px"
                        px="8px"
                        borderRadius="8px"
                        bg="hg.card"
                        fontSize="12px"
                        disabled={disabled}
                    />
                    <chakra.span color="hg.text.faint">%</chakra.span>
                </Flex>
                {parseFloat(value) > 5 && (
                    <chakra.span fontSize="12px" color="hg.warning.text">
                        ⚠ High slippage may result in unfavorable rates
                    </chakra.span>
                )}
            </Flex>
        )}
    </>
);

/** The inset summary under a form. */
export const SummaryBox = ({children}: { children: ReactNode }) => (
    <Flex direction="column" gap="10px" w="full" bg="hg.inset" borderRadius="14px" px="16px" py="14px" fontSize="14px">
        {children}
    </Flex>
);

export const SummaryLine = ({label, small, children}: { label: ReactNode; small?: boolean; children: ReactNode }) => (
    <Flex justify="space-between" gap="12px" fontSize={small ? '12px' : '14px'}>
        <chakra.span color={small ? 'hg.text.faint' : 'hg.text.muted'}>{label}</chakra.span>
        {small ? <span>{children}</span> : <chakra.strong>{children}</chakra.strong>}
    </Flex>
);

/** A form's title, centred. */
export const FormTitle = ({children}: { children: ReactNode }) => (
    <chakra.h2 m="0" fontSize="18px" fontWeight="700" textAlign="center">{children}</chakra.h2>
);

/** A form column: 640 px wide at most, centred in its card. */
export const FormColumn = ({children}: { children: ReactNode }) => (
    <Flex direction="column" gap="14px" w="full" maxW="640px" mx="auto">{children}</Flex>
);

/** The form's one gradient button. */
export const SubmitButton = (props: ComponentProps<typeof Button>) => (
    <Button
        w="full"
        h="52px"
        borderRadius="14px"
        fontSize="16px"
        fontWeight="700"
        variant={hgVariant('primary')}
        gap="8px"
        {...props}
    />
);

/** A centred figure on an inset tile of the pool overview. */
export const InsetTile = ({label, children, align = 'center'}: { label: ReactNode; children: ReactNode; align?: 'center' | 'start' }) => (
    <Flex
        direction="column"
        align={align === 'center' ? 'center' : 'flex-start'}
        textAlign={align === 'center' ? 'center' : 'start'}
        gap="6px"
        bg="hg.inset"
        borderRadius="14px"
        p="14px"
        minW="0"
    >
        <chakra.span fontSize="13px" color="hg.text.faint" display="inline-flex" alignItems="center" gap="4px">{label}</chakra.span>
        {children}
    </Flex>
);

export interface PillTab<T extends string> {
    value: T;
    label: ReactNode;
    /** The label on phones, where the tabs share one row ("Add" for "Add Liquidity"). */
    short?: ReactNode;
    icon?: ReactNode;
}

/** The pool form tabs: an inset track whose picked tab takes the DEX gradient. On a phone the
 * track spans the card and the tabs share its row equally, with their short labels. */
export function PillTabs<T extends string>({tabs, value, onChange, 'aria-label': ariaLabel}: {
    tabs: PillTab<T>[];
    value: T;
    onChange: (value: T) => void;
    'aria-label': string;
}) {
    return (
        <Flex role="tablist" aria-label={ariaLabel} alignSelf={{base: 'stretch', md: 'center'}} gap="4px" p="4px" borderRadius="12px" bg="hg.inset" wrap={{base: 'nowrap', md: 'wrap'}} justify="center" maxW="full" data-testid="pill-tabs">
            {tabs.map((tab) => {
                const selected = tab.value === value;
                return (
                    <chakra.button
                        key={tab.value}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => onChange(tab.value)}
                        h="36px"
                        px={{base: '8px', md: '14px'}}
                        flex={{base: '1', md: 'none'}}
                        minW="0"
                        border="0"
                        borderRadius="9px"
                        display="inline-flex"
                        alignItems="center"
                        justifyContent="center"
                        whiteSpace="nowrap"
                        gap="6px"
                        fontSize="14px"
                        fontWeight={selected ? '700' : '600'}
                        bgImage={selected ? 'app' : undefined}
                        bg={selected ? undefined : 'transparent'}
                        color={selected ? 'hg.buttonText' : 'hg.text.muted'}
                        cursor="pointer"
                        focusVisibleRing="outside"
                        _hover={selected ? undefined : {color: 'fg'}}
                    >
                        {tab.icon && <Box as="span" display="inline-flex" aria-hidden>{tab.icon}</Box>}
                        {tab.short ? (
                            <>
                                <chakra.span hideBelow="md">{tab.label}</chakra.span>
                                <chakra.span hideFrom="md">{tab.short}</chakra.span>
                            </>
                        ) : tab.label}
                    </chakra.button>
                );
            })}
        </Flex>
    );
}

/** The staking APR before and after the new stake, shown when it moves more than 10 %. */
export const AprMove = ({current, next, change}: { current: BigNumber; next: BigNumber; change: BigNumber }) => (
    <Flex direction="column" gap="6px" w="full" bg="hg.inset" borderRadius="14px" px="16px" py="12px" fontSize="13px">
        <Flex justify="space-between" align="center">
            <chakra.strong>New Staking APR</chakra.strong>
            <Badge variant={hgVariant(change.lt(0) ? 'danger' : 'success')}>
                {change.lt(0) ? '' : '+'}{change.toFixed(1)}%
            </Badge>
        </Flex>
        <Flex justify="space-between" color="hg.text.muted">
            <span>Current: {current.toFixed(2)}%</span>
            <chakra.span color="fg" fontWeight="700">New: {next.toFixed(2)}%</chakra.span>
        </Flex>
    </Flex>
);

/** One share of the trading fee, with its explanation on hover. */
export const FeeShare = ({label, hint, loading, children}: { label: string; hint: string; loading: boolean; children: ReactNode }) => (
    <Tooltip content={hint}>
        {/* A label that wraps ("Buyback & Burn" on a phone) must not lift its number above the
            others: the share fills its grid cell and its number sits on the bottom edge. */}
        <Flex direction="column" justify="space-between" h="full" gap="4px" cursor="help" tabIndex={0} aria-label={`${label}: ${hint}`} data-testid="fee-share">
            <chakra.span fontSize="12px" color="hg.text.faint" display="inline-flex" alignItems="center" justifyContent="center" gap="4px">
                {label}<LuInfo size={12} aria-hidden="true"/>
            </chakra.span>
            <Skeleton asChild loading={loading}>
                <chakra.strong fontSize="16px">{children}</chakra.strong>
            </Skeleton>
        </Flex>
    </Tooltip>
);
