'use client';

import type {ComponentType} from 'react';
import {Field, Input, Textarea} from '@chakra-ui/react';
import {chakra, Flex} from '@chakra-ui/react';
import BigNumber from 'bignumber.js';
import {Notice, uAmountToAmount} from '@bze/bze-ui-kit';
import {ACCEPT_ID, NOMINATE_ID, WITHDRAW_ID} from '@/lib/actions/admin';
import {CUSTOM_ID, customPlaceholder} from '@/lib/actions/custom';
import {ELECTORATE_ID} from '@/lib/actions/electorate';
import {MEMBERS_ID} from '@/lib/actions/members';
import {METADATA_ID} from '@/lib/actions/metadata';
import {PAY_ID} from '@/lib/actions/pay';
import {RULES_ID} from '@/lib/actions/rules';
import {SUB_ADMIN_ID, SUB_EXECUTE_ID} from '@/lib/actions/sub-dao';
import type {ActionFields} from '@/lib/actions/types';
import {
    AcceptForm, ElectorateForm, inputProps, monoProps, textareaProps, MembersForm, MetadataForm, NominateForm, RulesForm, SubAdminForm, SubExecuteForm, WithdrawForm,
    type ActionFormProps,
} from './forms';

export type {ActionFormProps};

const label = {fontSize: '14px', fontWeight: '600'} as const;
const helper = {fontSize: '12px', color: 'hg.text.faint'} as const;

/** The amount and its token in one field, as on the board: the number on the left, the token on the right. */
const fieldBox = {
    display: 'flex', alignItems: 'center', gap: '10px', h: '48px', px: '14px', borderRadius: '12px', bg: 'hg.inset',
    borderWidth: '1px', borderColor: 'hg.lineStrong', _focusWithin: {borderColor: 'app.focusRing'},
} as const;

const PayForm = ({fields, onChange, ctx, error}: ActionFormProps) => {
    const set = (patch: ActionFields) => onChange({...fields, ...patch});
    const treasury = ctx.treasury ?? [];
    const decimals = ctx.decimalsOf(fields.denom ?? '');
    const held = treasury.find((c) => c.denom === fields.denom);
    const heldText = held ? `${new BigNumber(uAmountToAmount(held.amount, decimals ?? 0)).toFormat()} ${ctx.ticker(held.denom)}` : null;

    return (
        <Flex direction="column" gap="16px">
            {ctx.treasury === null && <chakra.p m="0" fontSize="13px" color="hg.text.secondary">The treasury could not be read right now, so its tokens cannot be listed.</chakra.p>}
            <chakra.div display="grid" gridTemplateColumns={{base: '1fr', md: 'repeat(2, minmax(0, 1fr))'}} gap="16px">
                <Field.Root>
                    <Field.Label {...label}>Amount</Field.Label>
                    <chakra.span {...fieldBox} w="100%">
                        <chakra.input
                            flex="1" minW="0" bg="transparent" border="0" outline="none" color="fg" fontSize="15px" fontWeight="500"
                            inputMode="decimal" placeholder="e.g. 250" aria-label="Amount" value={fields.amount ?? ''}
                            onChange={(e) => set({amount: e.target.value})} data-testid="pay-amount"
                        />
                        <chakra.select
                            flex="none" maxW="45%" bg="transparent" border="0" outline="none" color="fg.muted" fontSize="14px" cursor="pointer"
                            value={fields.denom ?? ''} onChange={(e) => set({denom: e.target.value})} data-testid="pay-denom" aria-label="Token to pay"
                        >
                            {treasury.length === 0 && <option value="">No tokens</option>}
                            {treasury.map((c) => <option key={c.denom} value={c.denom}>{ctx.ticker(c.denom)}</option>)}
                        </chakra.select>
                    </chakra.span>
                    {heldText && <Field.HelperText {...helper} data-testid="pay-held">{`Treasury holds ${heldText}.`}</Field.HelperText>}
                    {decimals === null && <Field.HelperText {...helper}>This token is not known to the app: write the amount in its smallest unit.</Field.HelperText>}
                </Field.Root>
                <Field.Root>
                    <Field.Label {...label}>To</Field.Label>
                    <Input {...inputProps} {...monoProps} placeholder="bze1…" value={fields.to ?? ''} onChange={(e) => set({to: e.target.value})} data-testid="pay-to" />
                </Field.Root>
            </chakra.div>
            {error && <chakra.p m="0" fontSize="13px" fontWeight="500" color="hg.danger.text" role="alert" data-testid="action-error">{error}</chakra.p>}
        </Flex>
    );
};

const CustomForm = ({fields, onChange, ctx, error}: ActionFormProps) => (
    <Flex direction="column" gap="16px">
        <Field.Root>
            <Field.Label {...label}>Message (proto JSON with @type)</Field.Label>
            <Textarea
                {...textareaProps}
                {...monoProps}
                value={fields.json ?? ''}
                onChange={(e) => onChange({...fields, json: e.target.value})}
                rows={6}
                placeholder={customPlaceholder(ctx.dao.address)}
                data-testid="custom-json"
            />
            <Field.HelperText {...helper}>
                {`In snake_case with enums as numbers. It runs as the DAO, so every signer must be the DAO's own address (${ctx.dao.address}).`}
            </Field.HelperText>
        </Field.Root>
        {error && (
            <Notice status="danger" title="The chain would refuse this">
                <span role="alert" data-testid="action-error">{error}</span>
            </Notice>
        )}
    </Flex>
);

/**
 * The form of each registry entry, by `ActionEntry.id`. **Extension point:** a new entry in
 * `lib/actions/registry.ts` gets its form here; the list, review, draft and submit pick it up.
 */
export const ACTION_FORMS: Record<string, ComponentType<ActionFormProps>> = {
    [PAY_ID]: PayForm,
    [METADATA_ID]: MetadataForm,
    [RULES_ID]: RulesForm,
    [MEMBERS_ID]: MembersForm,
    [ELECTORATE_ID]: ElectorateForm,
    [NOMINATE_ID]: NominateForm,
    [WITHDRAW_ID]: WithdrawForm,
    [ACCEPT_ID]: AcceptForm,
    [SUB_ADMIN_ID]: SubAdminForm,
    [SUB_EXECUTE_ID]: SubExecuteForm,
    [CUSTOM_ID]: CustomForm,
};
