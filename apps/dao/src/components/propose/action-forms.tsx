'use client';

import type {ComponentType} from 'react';
import {Field, Input, NativeSelect, Textarea} from '@chakra-ui/react';
import {chakra, Flex} from '@chakra-ui/react';
import BigNumber from 'bignumber.js';
import {uAmountToAmount} from '@bze/bze-ui-kit';
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
    AcceptForm, ElectorateForm, inputProps, MembersForm, MetadataForm, NominateForm, RulesForm, SubAdminForm, SubExecuteForm, WithdrawForm,
    type ActionFormProps,
} from './forms';

export type {ActionFormProps};

const PayForm = ({fields, onChange, ctx, error}: ActionFormProps) => {
    const set = (patch: ActionFields) => onChange({...fields, ...patch});
    const treasury = ctx.treasury ?? [];
    const decimals = ctx.decimalsOf(fields.denom ?? '');
    const held = treasury.find((c) => c.denom === fields.denom);
    const heldText = held ? `${new BigNumber(uAmountToAmount(held.amount, decimals ?? 0)).toFormat()} ${ctx.ticker(held.denom)}` : null;

    return (
        <Flex direction="column" gap="12px">
            {ctx.treasury === null && <chakra.p m="0" fontSize="13px" color="fg.muted">The treasury could not be read right now, so its tokens cannot be listed.</chakra.p>}
            <Field.Root>
                <Field.Label fontSize="14px" fontWeight="600">Token</Field.Label>
                <NativeSelect.Root>
                    <NativeSelect.Field value={fields.denom ?? ''} onChange={(e) => set({denom: e.target.value})} data-testid="pay-denom" aria-label="Token to pay">
                        {treasury.length === 0 && <option value="">No tokens in the treasury</option>}
                        {treasury.map((c) => <option key={c.denom} value={c.denom}>{ctx.ticker(c.denom)}</option>)}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                </NativeSelect.Root>
                {heldText && <Field.HelperText data-testid="pay-held">{`The treasury holds ${heldText}.`}</Field.HelperText>}
            </Field.Root>
            <Field.Root>
                <Field.Label fontSize="14px" fontWeight="600">Amount</Field.Label>
                <Input {...inputProps} inputMode="decimal" placeholder="e.g. 250" value={fields.amount ?? ''} onChange={(e) => set({amount: e.target.value})} data-testid="pay-amount" />
                {decimals === null && <Field.HelperText>This token is not known to the app: write the amount in its smallest unit.</Field.HelperText>}
            </Field.Root>
            <Field.Root>
                <Field.Label fontSize="14px" fontWeight="600">Pay to</Field.Label>
                <Input {...inputProps} fontFamily="mono" fontSize="14px" placeholder="bze1…" autoCapitalize="none" spellCheck={false} value={fields.to ?? ''} onChange={(e) => set({to: e.target.value})} data-testid="pay-to" />
            </Field.Root>
            {error && <chakra.p m="0" fontSize="13px" color="red.500" role="alert" data-testid="action-error">{error}</chakra.p>}
        </Flex>
    );
};

const CustomForm = ({fields, onChange, ctx, error}: ActionFormProps) => (
    <Flex direction="column" gap="10px">
        <chakra.p m="0" fontSize="13px" color="fg.muted">
            One message as JSON with its <code>@type</code>, in snake_case with enums as numbers. It runs as the DAO, so its signer field must be the DAO&apos;s own address
            {` (${ctx.dao.address}).`}
        </chakra.p>
        <Field.Root>
            <Field.Label fontSize="14px" fontWeight="600">Message</Field.Label>
            <Textarea
                value={fields.json ?? ''}
                onChange={(e) => onChange({...fields, json: e.target.value})}
                rows={9}
                placeholder={customPlaceholder(ctx.dao.address)}
                fontFamily="mono"
                fontSize="13px"
                spellCheck={false}
                autoCapitalize="none"
                bg="bg.panel"
                borderRadius="12px"
                data-testid="custom-json"
            />
        </Field.Root>
        {error && <chakra.p m="0" fontSize="13px" color="red.500" role="alert" data-testid="action-error">{error}</chakra.p>}
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
