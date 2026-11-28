'use client';

import {Fragment, useEffect, useRef, useState, type Ref} from 'react';
import NextLink from 'next/link';
import {chakra, CloseButton, Dialog, Flex, Portal} from '@chakra-ui/react';
import {LuArrowLeft} from 'react-icons/lu';
import type {Dao} from '@bze/bze-ui-kit';
import {getExplorerAccountURL} from '@bze/bze-ui-kit';
import {linkify} from '@/lib/dao-text';
import {createdOnLine, descriptionOverflows} from '@/lib/dao-shell';
import type {ScanDaoDetail} from '@/lib/dao-types';
import {governedByLine} from '@/lib/home-list';
import {shortAddress} from '@/lib/format';
import {CopyAddress, Eyebrow, Note, OutLink, Pill} from './bits';

/** The pill of the header: who decides in the DAO. */
export const governancePill = (type: Dao['type']): string => governedByLine(type === 'DAO_TYPE_STAKE' ? 'stake' : 'static_list');

/** The DAO's description as plain text: line breaks kept, only http(s) links. Never HTML. `clamp` cuts it to 3 lines. */
export const DescriptionText = ({text, clamp, testId = 'dao-description', ref}: {text: string; clamp?: boolean; testId?: string; ref?: Ref<HTMLParagraphElement>}) => (
    <chakra.p
        ref={ref}
        m="0"
        fontSize={clamp ? {base: '15px', md: '16px'} : '15px'}
        lineHeight={clamp ? '1.55' : '1.6'}
        color="hg.text.secondary"
        whiteSpace="pre-line"
        overflowWrap="anywhere"
        lineClamp={clamp ? 3 : undefined}
        data-testid={testId}
    >
        {linkify(text).map((segment, i) => segment.kind === 'link'
            ? <chakra.a key={i} href={segment.href} target="_blank" rel="noopener noreferrer nofollow ugc" color="hg.link" textDecoration="underline">{segment.text}</chakra.a>
            : <Fragment key={i}>{segment.text}</Fragment>)}
    </chakra.p>
);

/** The description clamped to 3 lines; "View all" (only when it overflows) opens the whole text in a dialog. */
const Description = ({name, text}: {name: string; text: string}) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLParagraphElement>(null);
    // null until the browser has measured the clamped text
    const [measured, setMeasured] = useState<boolean | null>(null);

    // the clamped text is measured whenever its box changes (in a ResizeObserver callback, never in the effect's
    // own turn) and the measurement decides; only where there is no ResizeObserver (and before the first
    // measurement, so the server and the first client render agree) the length rule stands in
    useEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => setMeasured(el.scrollHeight > el.clientHeight + 1));
        observer.observe(el);
        return () => observer.disconnect();
    }, [text]);

    const overflows = measured ?? descriptionOverflows(text);

    return (
        <Flex direction="column" gap="6px" align="flex-start" minW="0" maxW="760px">
            <DescriptionText text={text} clamp ref={ref} />
            {overflows && (
                <chakra.button type="button" py="4px" px="0" border="0" bg="transparent" color="hg.link" fontWeight="600" fontSize="14px" cursor="pointer" onClick={() => setOpen(true)} data-testid="dao-description-all">
                    View all
                </chakra.button>
            )}
            <Dialog.Root open={open} onOpenChange={(e) => setOpen(e.open)} placement="center" scrollBehavior="inside" lazyMount unmountOnExit>
                <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content maxW={{base: '92vw', md: '640px'}} maxH="640px" bg="hg.card" borderWidth="1px" borderColor="hg.hairline" borderRadius="20px" boxShadow="0 40px 80px -30px rgba(0,0,0,0.9)" data-testid="dao-description-dialog">
                            <Dialog.Header pt="24px" px="24px" pb="0" pr="64px">
                                <Dialog.Title fontSize="19px" fontWeight="700" overflowWrap="anywhere">{`About ${name}`}</Dialog.Title>
                            </Dialog.Header>
                            <Dialog.Body px="24px" pt="14px" pb="24px">
                                <DescriptionText text={text} testId="dao-description-full" />
                            </Dialog.Body>
                            <Dialog.CloseTrigger asChild top="18px" insetEnd="18px">
                                <CloseButton boxSize="36px" borderRadius="10px" color="fg.muted" aria-label="Close" />
                            </Dialog.CloseTrigger>
                        </Dialog.Content>
                    </Dialog.Positioner>
                </Portal>
            </Dialog.Root>
        </Flex>
    );
};

export interface DaoHeaderProps {
    dao: Dao;
    extras: {data: ScanDaoDetail | null | undefined; failed: boolean; retry: () => void};
}

/** The top of every DAO page: back link, who governs it, the name and its day, the description and the DAO's address. */
export const DaoHeader = ({dao, extras}: DaoHeaderProps) => {
    const created = createdOnLine(dao, extras.data);

    return (
        <chakra.section display="flex" flexDirection="column" gap="16px" minW="0" data-testid="dao-header">
            <chakra.a asChild alignSelf="flex-start" display="inline-flex" alignItems="center" gap="6px" fontSize="14px" fontWeight="500" color="fg.muted" textDecoration="none" _hover={{color: 'hg.link'}}>
                <NextLink href="/" data-testid="dao-back"><LuArrowLeft size={14} aria-hidden />All DAOs</NextLink>
            </chakra.a>
            <Flex direction="column" gap={{base: '10px', md: '12px'}} minW="0">
                <Flex gap="8px" align="center" wrap="wrap"><Pill tone="neutral" testId="dao-type">{governancePill(dao.type)}</Pill></Flex>
                <chakra.h1 m="0" fontSize={{base: '28px', md: '36px'}} lineHeight={{base: '1.15', md: '1.1'}} fontWeight="800" letterSpacing="-0.02em" overflowWrap="anywhere" data-testid="dao-name">
                    {dao.name}
                </chakra.h1>
                {created && <chakra.span fontSize="13px" color="hg.text.faint" data-testid="dao-created">{created}</chakra.span>}
                {dao.description && <Description name={dao.name} text={dao.description} />}
                <Flex gap={{base: '8px', md: '10px'}} align="center" wrap="wrap" minW="0" fontSize="13px" data-testid="dao-meta">
                    <Eyebrow>DAO address</Eyebrow>
                    <Flex as="span" align="center" gap="4px" minW="0" maxW="100%" data-testid="dao-address" data-address={dao.address}>
                        <chakra.span fontFamily="mono" fontSize="13px" color="hg.text.secondary" title={dao.address} minW="0">{shortAddress(dao.address)}</chakra.span>
                        <CopyAddress address={dao.address} label="Copy the DAO address" />
                    </Flex>
                    <OutLink href={getExplorerAccountURL(dao.address)} testId="dao-explorer">Explorer</OutLink>
                </Flex>
            </Flex>
            {extras.failed && (
                <Note
                    tone="amber"
                    title="Scan is down"
                    testId="scan-retry"
                    action={<chakra.button type="button" h="32px" px="12px" borderRadius="12px" fontSize="13px" fontWeight="600" color="fg" bg="hg.secondaryFill" borderWidth="1px" borderColor="hg.lineStrong" cursor="pointer" onClick={extras.retry}>Retry</chakra.button>}
                >
                    We couldn&apos;t reach BZE Scan, so creation info, names, history and your past votes are missing. Everything else comes from the chain and is current.
                </Note>
            )}
        </chakra.section>
    );
};
