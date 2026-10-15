import type { Asset } from '@bze/bze-ui-kit'
import type { Goal } from '@/lib/goals'

// The home search in everyday words (BFE-168): what people type ("airdrop", "list my token")
// mapped to goals through their synonyms, plus the user's own tokens. Pure, so it is unit-tested.

export const MAX_GOAL_RESULTS = 6
export const MAX_TOKEN_RESULTS = 3

/** Words that carry no meaning in a goal search ("make it stakable" → "make", "stakable"). */
const FILLER_WORDS = new Set(['a', 'an', 'the', 'it', 'my', 'i', 'me', 'to', 'of', 'for', 'and', 'in', 'on', 'want', 'how', 'do', 'can'])

/** Lower case, punctuation (dashes too) to spaces, one space between words. */
export function normalizeQuery(text: string): string {
    return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

const containsPhrase = (text: string, phrase: string) => ` ${text} `.includes(` ${phrase} `)

interface Normalized {
    goal: Goal;
    title: string;
    description: string;
    techTag: string;
    synonyms: string[];
}

const normalizeGoal = (goal: Goal): Normalized => ({
    goal,
    title: normalizeQuery(goal.title),
    description: normalizeQuery(goal.description),
    techTag: normalizeQuery(goal.techTag),
    synonyms: goal.synonyms.map(normalizeQuery),
})

/** The best rule a single word or phrase meets for one goal. */
function scoreTerm(g: Normalized, term: string): number {
    if (g.title === term) return 100
    if (g.title.startsWith(term)) return 80
    if (g.synonyms.includes(term)) return 70
    if (g.synonyms.some(s => s.startsWith(term) || containsPhrase(term, s))) return 50
    if (g.title.includes(term) || g.description.includes(term)) return 30
    if (g.techTag.includes(term)) return 20
    return 0
}

function scoreGoal(g: Normalized, query: string): number {
    const words = query.split(' ')
    if (words.length === 1) return scoreTerm(g, query)

    const meaningful = words.filter(w => !FILLER_WORDS.has(w))
    const sum = meaningful.reduce((total, word) => total + scoreTerm(g, word), 0)
    const phrase = g.synonyms.includes(query) ? 20 : 0
    // A phrase matching the title as a whole still counts as such ("create my token").
    return Math.max(sum + (sum > 0 ? phrase : 0), g.title === query ? 100 : 0, g.title.startsWith(query) ? 80 : 0)
}

export interface GoalSearchResult {
    goals: Goal[];
    tokens: Asset[];
}

/**
 * Goals ranked by how well they match `query` (score, then catalogue order), at most 6, and the
 * user's tokens whose ticker or name contains it, at most 3. An empty query finds nothing.
 */
export function searchGoals(query: string, goals: readonly Goal[], myTokens: readonly Asset[]): GoalSearchResult {
    const q = normalizeQuery(query)
    if (!q) return { goals: [], tokens: [] }

    const ranked = goals
        .map((goal, index) => ({ goal, index, score: scoreGoal(normalizeGoal(goal), q) }))
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .slice(0, MAX_GOAL_RESULTS)
        .map(r => r.goal)

    const tokens = myTokens
        .filter(a => normalizeQuery(a.ticker).includes(q) || normalizeQuery(a.name ?? '').includes(q))
        .slice(0, MAX_TOKEN_RESULTS)

    return { goals: ranked, tokens }
}
