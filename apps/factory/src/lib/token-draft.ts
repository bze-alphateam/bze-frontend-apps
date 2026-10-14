import { getFromLocalStorage, removeFromLocalStorage, setInLocalStorage } from '@bze/bze-ui-kit'

/** What "Create my token" collects. The subdenom is always derived from the symbol. */
export interface TokenForm {
    name: string;
    symbol: string;
    description: string;
    initialSupply: string;
}

export const TOKEN_FORM_KEYS = ['identity', 'description', 'supply'] as const
export type TokenFormStep = typeof TOKEN_FORM_KEYS[number]

/** The form plus which questions the user already answered (Continue or Skip). */
export interface TokenDraft {
    form: TokenForm;
    answered: TokenFormStep[];
}

export const EMPTY_TOKEN_FORM: TokenForm = { name: '', symbol: '', description: '', initialSupply: '' }

export const TOKEN_DRAFT_KEY = 'factory_launch_draft'
export const TOKEN_DRAFT_TTL = 30 * 24 * 60 * 60

const asString = (v: unknown) => (typeof v === 'string' ? v : '')

export function isEmptyTokenForm(form: TokenForm): boolean {
    return Object.values(form).every(v => v === '')
}

/** The saved draft, or undefined when there is none (or it can't be read). */
export function loadTokenDraft(): TokenDraft | undefined {
    const raw = getFromLocalStorage(TOKEN_DRAFT_KEY)
    if (!raw) return undefined
    try {
        const parsed = JSON.parse(raw) as { form?: Record<string, unknown>; answered?: unknown }
        const form: TokenForm = {
            name: asString(parsed.form?.name),
            symbol: asString(parsed.form?.symbol).toUpperCase(),
            description: asString(parsed.form?.description),
            initialSupply: asString(parsed.form?.initialSupply),
        }
        const answered = Array.isArray(parsed.answered)
            ? TOKEN_FORM_KEYS.filter(k => (parsed.answered as unknown[]).includes(k))
            : []
        return { form, answered }
    } catch {
        return undefined
    }
}

/** Saves the draft for 30 days; an empty form removes it instead. */
export function saveTokenDraft(draft: TokenDraft): void {
    if (isEmptyTokenForm(draft.form)) {
        clearTokenDraft()
        return
    }
    setInLocalStorage(TOKEN_DRAFT_KEY, JSON.stringify(draft), TOKEN_DRAFT_TTL)
}

export function clearTokenDraft(): void {
    removeFromLocalStorage(TOKEN_DRAFT_KEY)
}
