'use client';

import {useState} from 'react';
import {chakra, Field, Flex, Input, Textarea} from '@chakra-ui/react';
import type {Dao, DaoParams} from '@bze/bze-ui-kit';
import {utf8Length} from '@bze/bze-ui-kit';
import {expeditedExplanation} from '@/lib/propose/expedite';
import {PlainText} from '@/components/ui/plain-text';
import {Panel} from '@/components/dao/page/panel';

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

const Counter = ({used, max, testId}: {used: number; max: number; testId: string}) => (
    <chakra.span fontSize="12px" color={used > max ? 'red.500' : 'hg.text.faint'} data-testid={testId}>
        {`${used.toLocaleString('en-US')} / ${max.toLocaleString('en-US')} bytes`}
    </chakra.span>
);

/** Title, summary (with a plain-text preview) and the expedited switch. */
export const Basics = ({dao, params, title, summary, expedited, onTitle, onSummary, onExpedited}: Props) => {
    const [preview, setPreview] = useState(false);
    const maxTitle = Number(params.max_title_len);
    const maxSummary = Number(params.max_summary_len);

    return (
        <Panel id="basics" title="The proposal" testId="basics-panel">
            <Field.Root>
                <Field.Label fontSize="14px" fontWeight="600">Title</Field.Label>
                <Input
                    value={title}
                    onChange={(e) => onTitle(e.target.value)}
                    placeholder="What are you proposing?"
                    h="46px"
                    borderRadius="12px"
                    fontSize="16px"
                    bg="bg.panel"
                    data-testid="proposal-title"
                />
                <Counter used={utf8Length(title)} max={maxTitle} testId="title-count" />
            </Field.Root>

            {maxSummary > 0 && (
                <Field.Root>
                    <Flex justify="space-between" align="center" w="100%">
                        <Field.Label fontSize="14px" fontWeight="600">Summary</Field.Label>
                        <chakra.button type="button" color="hg.link" fontSize="13px" fontWeight="600" cursor="pointer" onClick={() => setPreview((p) => !p)} data-testid="summary-preview-toggle">
                            {preview ? 'Edit' : 'Preview'}
                        </chakra.button>
                    </Flex>
                    {preview ? (
                        <chakra.div w="100%" minH="120px" p="12px" borderWidth="1px" borderColor="app.border" borderRadius="12px" data-testid="summary-preview">
                            {summary.trim() === '' ? <chakra.span color="fg.muted">Nothing to preview yet.</chakra.span> : <PlainText text={summary} />}
                        </chakra.div>
                    ) : (
                        <Textarea
                            value={summary}
                            onChange={(e) => onSummary(e.target.value)}
                            placeholder="Why, and what happens next. Shown as plain text: line breaks are kept and web links become links."
                            rows={6}
                            bg="bg.panel"
                            borderRadius="12px"
                            data-testid="proposal-summary-input"
                        />
                    )}
                    <Counter used={utf8Length(summary)} max={maxSummary} testId="summary-count" />
                </Field.Root>
            )}

            {dao.config.allow_expedite && (
                <Flex direction="column" gap="6px" data-testid="expedite-box">
                    <chakra.label display="flex" alignItems="center" gap="10px" fontWeight="600" fontSize="15px" cursor="pointer">
                        <input type="checkbox" checked={expedited} onChange={(e) => onExpedited(e.target.checked)} data-testid="expedited-switch" />
                        Expedited
                    </chakra.label>
                    <chakra.ul m="0" ps="20px" display="flex" flexDirection="column" gap="2px" fontSize="13px" color="fg.muted">
                        {expeditedExplanation(dao, params.min_expedite_delay).map((line) => <li key={line}>{line}</li>)}
                    </chakra.ul>
                </Flex>
            )}
        </Panel>
    );
};
