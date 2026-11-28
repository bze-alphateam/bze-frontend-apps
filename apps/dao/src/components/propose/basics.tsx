'use client';

import {useState} from 'react';
import {chakra, Flex} from '@chakra-ui/react';
import type {Dao, DaoParams} from '@bze/bze-ui-kit';
import {utf8Length} from '@bze/bze-ui-kit';
import {bytesLine, summaryLine} from '@/lib/propose/composer-text';
import {expeditedExplanation} from '@/lib/propose/expedite';
import {PlainText} from '@/components/ui/plain-text';
import {NeutralNote} from './neutral-note';
import {Segmented} from './segmented';

interface Props {
    dao: Pick<Dao, 'type' | 'config'>;
    params: Pick<DaoParams, 'max_title_len' | 'max_summary_len' | 'min_expedite_delay'>;
    title: string;
    summary: string;
    expedited: boolean;
    onTitle: (value: string) => void;
    onSummary: (value: string) => void;
    onExpedited: (value: boolean) => void;
}

/** The boards' field: a 12 px inset box with a strong hairline; red while the text is over its limit. */
const field = (over: boolean) => ({
    display: 'flex',
    gap: '10px',
    px: '14px',
    borderRadius: '12px',
    bg: 'hg.inset',
    borderWidth: '1px',
    borderColor: over ? 'hg.danger/60' : 'hg.lineStrong',
    _focusWithin: {borderColor: over ? 'hg.danger' : 'app.focusRing'},
}) as const;

const control = {flex: '1', minW: '0', bg: 'transparent', border: '0', outline: 'none', color: 'fg', fontSize: '15px', fontWeight: '500'} as const;

const Count = ({line, testId}: {line: {text: string; over: boolean}; testId: string}) => (
    <chakra.span fontSize="12px" fontWeight={line.over ? '500' : '400'} color={line.over ? 'hg.danger.text' : 'hg.text.faint'} data-testid={testId} aria-live="polite">
        {line.text}
    </chakra.span>
);

/** Title, summary (Write / Preview) and the expedited switch: the top of the composer's main card (board F1). */
export const Basics = ({dao, params, title, summary, expedited, onTitle, onSummary, onExpedited}: Props) => {
    const [view, setView] = useState<'write' | 'preview'>('write');
    const titleLine = bytesLine(utf8Length(title), Number(params.max_title_len));
    const maxSummary = Number(params.max_summary_len);
    const summaryCount = summaryLine(utf8Length(summary), maxSummary);
    const explanation = expeditedExplanation(dao, params.min_expedite_delay);

    return (
        <Flex direction="column" gap="22px" minW="0" data-testid="basics-panel">
            <chakra.label display="flex" flexDirection="column" gap="8px" fontSize="14px" fontWeight="600" minW="0">
                Title
                <chakra.span {...field(titleLine.over)} alignItems="center" h="48px">
                    <chakra.input {...control} value={title} onChange={(e) => onTitle(e.target.value)} placeholder="What are you proposing?" aria-invalid={titleLine.over || undefined} data-testid="proposal-title" />
                </chakra.span>
                <Count line={titleLine} testId="title-count" />
            </chakra.label>

            {maxSummary > 0 && (
                <Flex direction="column" gap="8px" minW="0">
                    <Flex gap="16px" align="center" justify="space-between" wrap="wrap">
                        <chakra.span id="summary-label" fontSize="14px" fontWeight="600">Summary</chakra.span>
                        {/* a phone has no Preview (board I5): the counter line says how it is shown */}
                        <chakra.div display={{base: 'none', md: 'block'}} data-testid="summary-view-wrap">
                            <Segmented
                                label="Summary"
                                value={view}
                                onChange={setView}
                                options={[{value: 'write', label: 'Write', testId: 'summary-write'}, {value: 'preview', label: 'Preview', testId: 'summary-preview-toggle'}]}
                                testId="summary-view"
                            />
                        </chakra.div>
                    </Flex>
                    {view === 'preview' ? (
                        <chakra.div {...field(summaryCount.over)} display="block" minH="168px" py="12px" fontSize="15px" lineHeight="1.5" overflowWrap="anywhere" data-testid="summary-preview">
                            {summary.trim() === '' ? <chakra.span color="fg.muted">Nothing to preview yet.</chakra.span> : <PlainText text={summary} />}
                        </chakra.div>
                    ) : (
                        <chakra.span {...field(summaryCount.over)} alignItems="flex-start">
                            <chakra.textarea
                                {...control}
                                rows={6}
                                h={{base: '114px', md: 'auto'}}
                                resize="vertical"
                                lineHeight="1.5"
                                py="12px"
                                value={summary}
                                onChange={(e) => onSummary(e.target.value)}
                                placeholder="Why, and what happens next."
                                aria-labelledby="summary-label"
                                aria-invalid={summaryCount.over || undefined}
                                data-testid="proposal-summary-input"
                            />
                        </chakra.span>
                    )}
                    <chakra.span display={{base: 'none', md: 'inline'}}><Count line={summaryCount} testId="summary-count" /></chakra.span>
                    <chakra.span display={{base: 'inline', md: 'none'}}><Count line={{text: summaryCount.short, over: summaryCount.over}} testId="summary-count-phone" /></chakra.span>
                </Flex>
            )}

            {dao.config.allow_expedite ? (
                <chakra.section bg="hg.inset" borderWidth="1px" borderColor="hg.hairline" borderRadius="16px" p={{base: '14px', md: '16px'}} data-testid="expedite-box">
                    <chakra.label display="flex" alignItems="flex-start" gap="12px" cursor="pointer">
                        <chakra.span position="relative" flex="none" w="44px" h="25px" borderRadius="999px" mt="1px" bg={expedited ? 'app.solid' : 'hg.switchOff'} transition="background 120ms">
                            <chakra.input
                                type="checkbox"
                                role="switch"
                                aria-label="Expedited"
                                checked={expedited}
                                onChange={(e) => onExpedited(e.target.checked)}
                                position="absolute"
                                inset="0"
                                opacity={0}
                                m="0"
                                cursor="pointer"
                                data-testid="expedited-switch"
                            />
                            <chakra.span position="absolute" top="3px" left={expedited ? '22px' : '3px'} boxSize="19px" borderRadius="999px" bg="white" transition="left 120ms" pointerEvents="none" />
                        </chakra.span>
                        <Flex as="span" direction="column" gap="2px" fontSize="14px" fontWeight="600">
                            Expedited
                            <chakra.span fontSize="13px" fontWeight="400" color="hg.text.faint" display={{base: 'none', md: 'inline'}} data-testid="expedite-explanation">{explanation.full}</chakra.span>
                            <chakra.span fontSize="13px" fontWeight="400" color="hg.text.faint" display={{base: 'inline', md: 'none'}} data-testid="expedite-explanation-phone">{explanation.short}</chakra.span>
                        </Flex>
                    </chakra.label>
                </chakra.section>
            ) : (
                <NeutralNote testId="expedite-not-allowed">This DAO doesn&apos;t allow expedited proposals, so the switch isn&apos;t shown.</NeutralNote>
            )}
        </Flex>
    );
};
