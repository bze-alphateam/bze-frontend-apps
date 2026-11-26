import BigNumber from 'bignumber.js';
import {validateBZEBech32Address} from '@bze/bze-ui-kit';
import {parseTokenAmount} from './amount';
import type {ActionContext, ActionEntry, ActionFields} from './types';

export const PAY_ID = 'pay';
export const MSG_SEND_TYPE_URL = '/cosmos.bank.v1beta1.MsgSend';

/** What the pay form holds: the token (a denom the treasury holds), the amount in display units, the recipient. */
export interface PayFields extends ActionFields {
    denom: string;
    amount: string;
    to: string;
}

const decimals = (ctx: ActionContext, denom: string): number => ctx.decimalsOf(denom) ?? 0;

const treasuryAmount = (ctx: ActionContext, denom: string): BigNumber | null => {
    const coin = ctx.treasury?.find((c) => c.denom === denom);
    return coin ? new BigNumber(coin.amount) : null;
};

/** The typed amount in base units; null when it is not a valid amount. */
const baseAmount = (fields: ActionFields, ctx: ActionContext): string | null => {
    const parsed = parseTokenAmount(fields.amount ?? '', decimals(ctx, fields.denom ?? ''));
    return parsed.ok ? parsed.base : null;
};

/**
 * Pay from the treasury: a bank send whose sender is the DAO's account. The token is one the treasury
 * holds. An amount above the balance is a warning, not an error: the chain accepts the proposal, and
 * the send only fails (and can be retried) when the treasury is short at settle time.
 */
export const payEntry: ActionEntry = {
    id: PAY_ID,
    label: 'Pay from the treasury',
    description: "Send tokens from the DAO's treasury to an address.",
    available: () => true,
    initialFields: (ctx) => ({denom: ctx.treasury?.[0]?.denom ?? '', amount: '', to: ''}),
    validate(fields, ctx) {
        if (ctx.treasury === null) return "The treasury could not be read, so there is nothing to choose a token from. Try again in a moment.";
        if (ctx.treasury.length === 0) return 'The treasury holds no tokens to send.';
        const denom = fields.denom ?? '';
        if (!ctx.treasury.some((c) => c.denom === denom)) return 'Choose a token the treasury holds.';

        const to = (fields.to ?? '').trim();
        if (to === '') return 'Enter the address to pay.';
        if (!validateBZEBech32Address(to).isValid) return 'The recipient is not a valid BeeZee address (it starts with bze1).';

        const parsed = parseTokenAmount(fields.amount ?? '', decimals(ctx, denom));
        if (!parsed.ok) return parsed.error;
        // an action that runs in the signed transaction cannot wait for the treasury to fill up
        const balance = treasuryAmount(ctx, denom);
        if (ctx.runsNow && balance !== null && new BigNumber(parsed.base).gt(balance)) return 'The treasury holds less than this: the payment would fail, and with it everything in the batch.';
        return undefined;
    },
    warnings(fields, ctx) {
        const warnings: string[] = [];
        const denom = fields.denom ?? '';
        const base = baseAmount(fields, ctx);
        const balance = treasuryAmount(ctx, denom);
        if (!ctx.runsNow && base !== null && balance !== null && new BigNumber(base).gt(balance)) {
            warnings.push(`The treasury holds less than this today. The proposal can still be submitted; if the treasury is short when it is settled, the payment fails and can be retried until the retry deadline.`);
        }
        if ((fields.to ?? '').trim().toLowerCase() === ctx.dao.address.toLowerCase()) {
            warnings.push("The recipient is the DAO's own account: the payment would move nothing.");
        }
        if (ctx.decimalsOf(denom) === null && denom !== '') {
            warnings.push(`${ctx.ticker(denom)} is not a token this app knows, so the amount is in its smallest unit.`);
        }
        return warnings;
    },
    build(fields, ctx) {
        const base = baseAmount(fields, ctx);
        const to = (fields.to ?? '').trim();
        if (base === null || to === '' || !fields.denom) throw new Error('the payment is not complete');
        return {
            typeUrl: MSG_SEND_TYPE_URL,
            value: {fromAddress: ctx.dao.address, toAddress: to, amount: [{denom: fields.denom, amount: base}]},
        };
    },
};
