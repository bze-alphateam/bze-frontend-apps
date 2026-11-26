'use client';

import {useState, type ReactNode} from 'react';
import {chakra, Flex} from '@chakra-ui/react';
import {LuCheck, LuCopy, LuExternalLink} from 'react-icons/lu';
import {getExplorerAccountURL, HgCard, useToast} from '@bze/bze-ui-kit';
import {shortAddress} from '@/lib/format';

/** A titled card of the DAO page. */
export const Panel = ({id, title, testId, children, aside}: {id: string; title: string; testId: string; children: ReactNode; aside?: ReactNode}) => (
    <HgCard as="section" aria-labelledby={`${id}-title`} data-testid={testId}>
        <Flex direction="column" gap="14px" p={{base: '16px', md: '20px'}}>
            <Flex justify="space-between" align="center" gap="12px" wrap="wrap">
                <chakra.h2 id={`${id}-title`} m="0" fontSize="18px" fontWeight="700">{title}</chakra.h2>
                {aside}
            </Flex>
            {children}
        </Flex>
    </HgCard>
);

/** A label and its value, stacked on a phone. */
export const Row = ({label, children, testId}: {label: string; children: ReactNode; testId?: string}) => (
    <Flex direction={{base: 'column', md: 'row'}} gap={{base: '2px', md: '16px'}} data-testid={testId}>
        <chakra.span flex={{md: '0 0 190px'}} fontSize="13px" color="hg.text.faint">{label}</chakra.span>
        <chakra.span fontSize="14px" minW="0" overflowWrap="anywhere">{children}</chakra.span>
    </Flex>
);

export const Tag = ({children, testId}: {children: ReactNode; testId?: string}) => (
    <chakra.span
        fontSize="12px"
        fontWeight="600"
        px="9px"
        py="3px"
        borderRadius="hg.pill"
        whiteSpace="nowrap"
        color="hg.link"
        bg="app.subtle"
        borderWidth="1px"
        borderColor="app.border"
        data-testid={testId}
    >
        {children}
    </chakra.span>
);

const iconButton = {
    display: 'inline-flex',
    alignItems: 'center',
    p: '4px',
    color: 'fg.muted',
    cursor: 'pointer',
    borderRadius: '6px',
    _hover: {color: 'hg.link'},
};

/** An account address: shortened, with copy and an explorer link. `name` (a label) leads when there is one. */
export const AddressLine = ({address, name, full, testId}: {address: string; name?: string; full?: boolean; testId?: string}) => {
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
        <Flex as="span" align="center" gap="4px" display="inline-flex" maxW="100%" data-testid={testId}>
            {name && <chakra.span fontWeight="600">{name}</chakra.span>}
            <chakra.span fontFamily="mono" fontSize="13px" color={name ? 'fg.muted' : undefined} title={address} overflowWrap="anywhere">
                {full ? address : shortAddress(address)}
            </chakra.span>
            <chakra.button type="button" {...iconButton} onClick={copy} aria-label={`Copy address ${address}`}>
                {copied ? <LuCheck size={14} aria-hidden /> : <LuCopy size={14} aria-hidden />}
            </chakra.button>
            <chakra.a {...iconButton} href={getExplorerAccountURL(address)} target="_blank" rel="noopener noreferrer" aria-label={`Open ${address} in the explorer`}>
                <LuExternalLink size={14} aria-hidden />
            </chakra.a>
        </Flex>
    );
};

/** "BZE Scan is not answering" line with a retry, for the parts only Scan can fill. */
export const ScanRetry = ({what, onRetry}: {what: string; onRetry: () => void}) => (
    <Flex gap="10px" align="center" wrap="wrap" fontSize="13px" color="fg.muted" data-testid="scan-retry">
        <span>{`${what} could not be loaded from BZE Scan.`}</span>
        <chakra.button type="button" color="hg.link" fontWeight="600" cursor="pointer" onClick={onRetry}>Retry</chakra.button>
    </Flex>
);
