'use client';

import {useState, type ReactNode} from 'react';
import {chakra, Flex} from '@chakra-ui/react';
import {LuCheck, LuCopy, LuExternalLink, LuInfo, LuTriangleAlert} from 'react-icons/lu';
import {AppIcon, appAccentColor, useToast} from '@bze/bze-ui-kit';

// The DAO page's own building blocks, with the board's values (cards, pills, label/value lists, notes).
// The `Panel` / `Tag` / `AddressLine` of ./panel stay as they are: other pages use them.

/** A pill's colour: the board's five tones. */
export type PillTone = 'indigo' | 'amber' | 'green' | 'red' | 'neutral';

const mix = (token: string, percent: number) => `color-mix(in srgb, var(--chakra-colors-${token}) ${percent}%, transparent)`;

const TONES: Record<PillTone, {color: string; bg: string; border: string; dot: string}> = {
    indigo: {color: 'hg.link.hover', bg: mix('hg-accent', 14), border: mix('hg-accent', 40), dot: 'hg.link.hover'},
    amber: {color: 'hg.warning.text', bg: mix('hg-warning', 12), border: mix('hg-warning', 38), dot: 'hg.warning.text'},
    green: {color: 'hg.success.text', bg: mix('hg-success', 12), border: mix('hg-success', 38), dot: 'hg.success.text'},
    red: {color: 'hg.danger.text', bg: mix('hg-danger', 12), border: mix('hg-danger', 38), dot: 'hg.danger.text'},
    neutral: {color: 'hg.text.secondary', bg: 'hg.inset', border: 'hg.hairline', dot: 'hg.text.secondary'},
};

/** A small rounded pill (statuses, roles, the type of a DAO); `dot` adds the 6 px dot of the live states. */
export const Pill = ({tone, dot, testId, children}: {tone: PillTone; dot?: boolean; testId?: string; children: ReactNode}) => {
    const t = TONES[tone];
    return (
        <chakra.span
            display="inline-flex"
            alignItems="center"
            gap="6px"
            fontSize="12px"
            fontWeight="600"
            px="9px"
            py="3px"
            borderRadius="999px"
            whiteSpace="nowrap"
            color={t.color}
            bg={t.bg}
            borderWidth="1px"
            borderColor={t.border}
            data-testid={testId}
            data-tone={tone}
        >
            {dot && <chakra.span aria-hidden boxSize="6px" borderRadius="999px" bg={t.dot} flex="none" data-testid="pill-dot" />}
            {children}
        </chakra.span>
    );
};

/** A card of the DAO page: 16 px corners, 22 × 24 px inside (16 px on a phone). */
export const Card = ({title, titleId, aside, gap = '16px', testId, children, as = 'section'}: {
    title?: ReactNode;
    titleId?: string;
    /** Right of the title (a total, a role pill). */
    aside?: ReactNode;
    gap?: string;
    testId?: string;
    as?: 'section' | 'div';
    children: ReactNode;
}) => (
    <chakra.section
        as={as}
        aria-labelledby={title && titleId ? titleId : undefined}
        bg="hg.card"
        borderWidth="1px"
        borderColor="hg.hairline"
        borderRadius="16px"
        p={{base: '16px', md: '22px 24px'}}
        display="flex"
        flexDirection="column"
        gap={gap}
        minW="0"
        data-testid={testId}
    >
        {title && (
            <Flex gap="16px" align="center" justify="space-between" wrap="wrap">
                <CardTitle id={titleId}>{title}</CardTitle>
                {aside}
            </Flex>
        )}
        {children}
    </chakra.section>
);

export const CardTitle = ({id, children}: {id?: string; children: ReactNode}) => (
    <chakra.h2 id={id} m="0" fontSize="17px" fontWeight="700">{children}</chakra.h2>
);

/** The uppercase label of a cell or a group ("ADMIN", "ON OPEN PROPOSALS"). */
export const Eyebrow = ({children}: {children: ReactNode}) => (
    <chakra.span fontSize="12px" fontWeight="700" letterSpacing="0.12em" textTransform="uppercase" color="hg.text.faint">{children}</chakra.span>
);

/** A label/value list: one row each, a hairline between rows. `wide` is the 190 px label column of the rules. */
export const Dl = ({rows, wide, size = '13px', pad = '6px', testId}: {
    rows: {key: string; label: ReactNode; value: ReactNode; testId?: string}[];
    wide?: boolean;
    size?: string;
    pad?: string;
    testId?: string;
}) => (
    <chakra.dl m="0" display="flex" flexDirection="column" data-testid={testId}>
        {rows.map((row, i) => (
            <chakra.div
                key={row.key}
                display="grid"
                gridTemplateColumns={wide ? {base: 'minmax(0, 1fr)', md: '190px minmax(0, 1fr)'} : 'minmax(0, 1fr) auto'}
                gap={wide ? {base: '2px', md: '16px'} : '16px'}
                py={wide ? {base: '7px', md: '12px'} : pad}
                borderTopWidth={i === 0 ? '0' : '1px'}
                borderColor="hg.divider"
                data-testid={row.testId}
            >
                <chakra.dt fontSize={wide ? {base: '13px', md: '14px'} : size} color="fg.muted" minW="0">{row.label}</chakra.dt>
                <chakra.dd m="0" fontSize={wide ? {base: '13px', md: '14px'} : size} lineHeight="1.5" color="fg" minW="0" overflowWrap="anywhere" textAlign={wide ? 'start' : 'end'}>
                    {row.value}
                </chakra.dd>
            </chakra.div>
        ))}
    </chakra.dl>
);

/** A thin rule inside a card. */
export const Rule = () => <chakra.div h="1px" bg="hg.divider" aria-hidden />;

/** A tinted note (the board's role="note"): an icon, a bold title, a line, and an action on the right. */
export const Note = ({tone, title, children, action, testId}: {tone: 'indigo' | 'amber' | 'neutral'; title?: ReactNode; children: ReactNode; action?: ReactNode; testId?: string}) => {
    const icon = tone === 'amber' ? 'hg.warning.text' : tone === 'indigo' ? 'hg.link' : 'fg.muted';
    const fill = tone === 'amber' ? mix('hg-warning', 8) : tone === 'indigo' ? mix('hg-accent', 8) : undefined;
    const edge = tone === 'amber' ? mix('hg-warning', 30) : tone === 'indigo' ? mix('hg-accent', 35) : undefined;
    return (
        <Flex
            role="note"
            gap="12px"
            align="flex-start"
            wrap="wrap"
            px="14px"
            py="12px"
            borderRadius="12px"
            borderWidth="1px"
            bg={fill ?? 'hg.inset'}
            borderColor={edge ?? 'hg.hairline'}
            data-testid={testId}
        >
            <chakra.span flex="none" mt="2px" color={icon} display="inline-flex">
                {tone === 'amber' ? <LuTriangleAlert size={16} aria-hidden /> : <LuInfo size={16} aria-hidden />}
            </chakra.span>
            <Flex direction="column" gap="2px" fontSize="14px" lineHeight="1.5" color="hg.text.secondary" minW="0" flex="1 1 220px">
                {title && <chakra.strong fontSize="14px" color="fg">{title}</chakra.strong>}
                <span>{children}</span>
            </Flex>
            {action && <chakra.span ms="auto" flex="none">{action}</chakra.span>}
        </Flex>
    );
};

/** The 24 px copy button beside an address. */
export const CopyAddress = ({address, label = 'Copy address'}: {address: string; label?: string}) => {
    const {toast} = useToast();
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard?.writeText(address).then(
            () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
            },
            () => toast.error('The address could not be copied'),
        );
    };
    return (
        <chakra.button type="button" boxSize="24px" display="inline-flex" alignItems="center" justifyContent="center" p="0" border="0" borderRadius="6px" bg="transparent" color="hg.link" cursor="pointer" onClick={copy} aria-label={label}>
            {copied ? <LuCheck size={13} aria-hidden /> : <LuCopy size={13} aria-hidden />}
        </chakra.button>
    );
};

/** A link out of the app (Explorer, Tx, Stake on DEX): the app's 16 px icon, the label in its accent, the arrow. */
export const OutLink = ({href, tone = 'explorer', testId, children}: {href: string; tone?: 'explorer' | 'dex'; testId?: string; children: ReactNode}) => (
    <chakra.a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        display="inline-flex"
        alignItems="center"
        gap="6px"
        px="6px"
        py="4px"
        borderRadius="6px"
        fontSize="14px"
        fontWeight="500"
        whiteSpace="nowrap"
        textDecoration="none"
        color={appAccentColor(tone)}
        _hover={{textDecoration: 'underline'}}
        data-testid={testId}
    >
        <AppIcon app={tone} size={16} />
        {children}
        <LuExternalLink size={12} aria-hidden />
    </chakra.a>
);
