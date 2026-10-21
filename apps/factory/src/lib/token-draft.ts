import { getFromLocalStorage, removeFromLocalStorage, setInLocalStorage } from '@bze/bze-ui-kit'

/** Who is the token's admin once it is created: the creator, or another address in the same tx. */
export type AdminChoice = 'mine' | 'other'

/** What "Create a token" collects. The subdenom is always derived from the symbol. */
export interface TokenForm {
    name: string;
    symbol: string;
    description: string;
    initialSupply: string;
    adminChoice: AdminChoice;
    /** The other admin, when `adminChoice` is 'other'. */
    adminAddress: string;
}

/** The steps the user answers; the Review step comes after them and is never "answered". */
export const TOKEN_FORM_KEYS = ['details', 'supply', 'permissions'] as const
export type TokenFormStep = typeof TOKEN_FORM_KEYS[number]

/** The form plus which steps the user already finished: the first unfinished one opens on return. */
export interface TokenDraft {
    form: TokenForm;
    answered: TokenFormStep[];
}

export const EMPTY_TOKEN_FORM: TokenForm = {
    name: '',
    symbol: '',
    description: '',
    initialSupply: '',
    adminChoice: 'mine',
    adminAddress: '',
}

export const TOKEN_DRAFT_KEY = 'factory_launch_draft'
export const TOKEN_DRAFT_TTL = 30 * 24 * 60 * 60

// Drafts saved before the four-step wizard named the first step 'identity'.
const LEGACY_STEPS: Record<string, TokenFormStep> = { identity: 'details' }

const asString = (v: unknown) => (typeof v === 'string' ? v : '')

export function isEmptyTokenForm(form: TokenForm): boolean {
    return form.name === '' && form.symbol === '' && form.description === '' && form.initialSupply === ''
        && form.adminChoice === 'mine' && form.adminAddress === ''
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
            adminChoice: parsed.form?.adminChoice === 'other' ? 'other' : 'mine',
            adminAddress: asString(parsed.form?.adminAddress),
        }
        const saved = Array.isArray(parsed.answered)
            ? (parsed.answered as unknown[]).map(k => (typeof k === 'string' ? LEGACY_STEPS[k] ?? k : k))
            : []
        const answered = TOKEN_FORM_KEYS.filter(k => saved.includes(k))
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
