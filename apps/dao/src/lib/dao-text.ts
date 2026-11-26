// Untrusted DAO text (name, description) shown as plain text: line breaks kept,
// links only for http(s) URLs. Nothing is ever rendered as HTML.

export type TextSegment =
    | {kind: 'text'; text: string}
    | {kind: 'link'; text: string; href: string};

/**
 * A URL a link may point to: http(s) only (mailto is not needed in a DAO text), else "".
 * Relative URLs and anything with spaces or markup characters are dropped.
 */
export function safeHttpUrl(url: string): string {
    const u = url.trim();
    if (!/^https?:\/\/[^\s<>"'`]+$/i.test(u)) return '';
    try {
        const parsed = new URL(u);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? u : '';
    } catch {
        return '';
    }
}

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;
const TRAILING = /[.,;:!?)\]}]+$/;

/** Splits a text into plain and link segments. A URL that fails `safeHttpUrl` stays plain text. */
export function linkify(text: string): TextSegment[] {
    const segments: TextSegment[] = [];
    let last = 0;
    const push = (kind: 'text', value: string) => {
        if (!value) return;
        const prev = segments[segments.length - 1];
        if (prev && prev.kind === 'text') prev.text += value;
        else segments.push({kind, text: value});
    };

    for (const match of text.matchAll(URL_PATTERN)) {
        const start = match.index ?? 0;
        let candidate = match[0];
        const trailing = TRAILING.exec(candidate)?.[0] ?? '';
        if (trailing) candidate = candidate.slice(0, candidate.length - trailing.length);

        push('text', text.slice(last, start));
        const href = safeHttpUrl(candidate);
        if (href) segments.push({kind: 'link', text: candidate, href});
        else push('text', candidate);
        push('text', trailing);
        last = start + match[0].length;
    }
    push('text', text.slice(last));
    return segments;
}
