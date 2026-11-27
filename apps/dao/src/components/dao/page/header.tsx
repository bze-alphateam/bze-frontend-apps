'use client';

import {Fragment, useEffect, useRef, useState, type Ref} from 'react';
import NextLink from 'next/link';
import {chakra, CloseButton, Dialog, Flex, Portal} from '@chakra-ui/react';
import {LuArrowLeft, LuCheck, LuCopy, LuExternalLink} from 'react-icons/lu';
import type {Dao} from '@bze/bze-ui-kit';
import {getExplorerAccountURL, useToast} from '@bze/bze-ui-kit';
import {linkify} from '@/lib/dao-text';
import {createdOnLine, descriptionOverflows} from '@/lib/dao-shell';
import type {ScanDaoDetail} from '@/lib/dao-types';
import {governedByLine} from '@/lib/home-list';
import {ScanRetry, Tag} from './panel';

/** The pill of the header: who decides in the DAO. */
export const governancePill = (type: Dao['type']): string => governedByLine(type === 'DAO_TYPE_STAKE' ? 'stake' : 'static_list');

/** The DAO's description as plain text: line breaks kept, only http(s) links. Never HTML. `clamp` cuts it to 3 lines. */
export const DescriptionText = ({text, clamp, testId = 'dao-description', ref}: {text: string; clamp?: boolean; testId?: string; ref?: Ref<HTMLParagraphElement>}) => (
    <chakra.p
        ref={ref}
        m="0"
        fontSize="15px"
        lineHeight="1.6"
        color="fg.muted"
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
    const [measured, setMeasured] = useState(false);

    // the clamped text is measured whenever its box changes (in a ResizeObserver callback, never in the effect's
    // own turn); where there is no ResizeObserver the length rule decides alone
    useEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => setMeasured(el.scrollHeight > el.clientHeight + 1));
        observer.observe(el);
        return () => observer.disconnect();
    }, [text]);

    const overflows = measured || descriptionOverflows(text);

    return (
        <Flex direction="column" gap="4px" align="flex-start" minW="0" maxW="100%">
            <DescriptionText text={text} clamp ref={ref} />
            {overflows && (
                <chakra.button type="button" color="hg.link" fontWeight="600" fontSize="14px" cursor="pointer" onClick={() => setOpen(true)} data-testid="dao-description-all">
                    View all
                </chakra.button>
            )}
            <Dialog.Root open={open} onOpenChange={(e) => setOpen(e.open)} placement="center" scrollBehavior="inside">
                <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content maxW={{base: '92vw', md: '640px'}} bg="hg.card" borderWidth="1px" borderColor="hg.hairline" borderRadius="20px" data-testid="dao-description-dialog">
                            <Dialog.Header pt="24px" px="24px" pb="0" pr="56px">
                                <Dialog.Title fontSize="19px" fontWeight="700" overflowWrap="anywhere">{`About ${name}`}</Dialog.Title>
                            </Dialog.Header>
                            <Dialog.Body px="24px" pt="16px" pb="24px">
                                <DescriptionText text={text} testId="dao-description-full" />
                            </Dialog.Body>
                            <Dialog.CloseTrigger asChild top="20px" insetEnd="18px">
                                <CloseButton size="sm" aria-label="Close" />
                            </Dialog.CloseTrigger>
                        </Dialog.Content>
                    </Dialog.Positioner>
                </Portal>
            </Dialog.Root>
        </Flex>
    );
};

const CopyButton = ({address}: {address: string}) => {
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
        <chakra.button type="button" display="inline-flex" alignItems="center" p="4px" color="hg.link" cursor="pointer" borderRadius="6px" onClick={copy} aria-label="Copy the DAO address">
            {copied ? <LuCheck size={14} aria-hidden /> : <LuCopy size={14} aria-hidden />}
        </chakra.button>
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
        <chakra.section display="flex" flexDirection="column" gap="14px" minW="0" data-testid="dao-header">
            <chakra.a asChild alignSelf="flex-start" display="inline-flex" alignItems="center" gap="6px" fontSize="14px" fontWeight="500" color="fg.muted" _hover={{color: 'hg.link'}}>
                <NextLink href="/" data-testid="dao-back"><LuArrowLeft size={14} aria-hidden />All DAOs</NextLink>
            </chakra.a>
            <Flex direction="column" gap="10px" minW="0">
                <Flex gap="6px" wrap="wrap"><Tag testId="dao-type">{governancePill(dao.type)}</Tag></Flex>
                <chakra.h1 m="0" fontSize={{base: '28px', md: '36px'}} lineHeight="1.15" fontWeight="800" letterSpacing="-0.02em" overflowWrap="anywhere" data-testid="dao-name">
                    {dao.name}
                </chakra.h1>
                {created && <chakra.span fontSize="13px" color="hg.text.faint" data-testid="dao-created">{created}</chakra.span>}
                {dao.description && <Description name={dao.name} text={dao.description} />}
                <Flex gap="8px" align="center" wrap="wrap" minW="0" data-testid="dao-meta">
                    <chakra.span fontSize="12px" fontWeight="700" letterSpacing="0.12em" textTransform="uppercase" color="hg.text.faint">DAO address</chakra.span>
                    <Flex as="span" align="center" gap="4px" minW="0" maxW="100%" data-testid="dao-address">
                        <chakra.span fontFamily="mono" fontSize="13px" overflowWrap="anywhere" minW="0">{dao.address}</chakra.span>
                        <CopyButton address={dao.address} />
                    </Flex>
                    <chakra.a href={getExplorerAccountURL(dao.address)} target="_blank" rel="noopener noreferrer" display="inline-flex" alignItems="center" gap="6px" fontSize="14px" fontWeight="500" color="hg.link" data-testid="dao-explorer">
                        Explorer<LuExternalLink size={12} aria-hidden />
                    </chakra.a>
                </Flex>
                {extras.failed && <ScanRetry what="The creation date, names and proposal counts" onRetry={extras.retry} />}
            </Flex>
        </chakra.section>
    );
};
