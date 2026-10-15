import { type LogoFormat, suggestLogoFileName } from '@/lib/registry-entry'

// The Cosmos Chain Registry's logo rules, checked in the browser before the user opens a PR.
// The format comes from the file's content, never from its extension.

/** The registry's size limit: under 250 KB. */
export const MAX_LOGO_BYTES = 250 * 1024
/** The registry rejects SVGs with 1,000 shapes or more. */
export const MAX_SVG_SHAPES = 1000
/** The step reads at most this much; bigger files fail the size check without being parsed. */
export const MAX_READ_BYTES = 2 * 1024 * 1024

export type LogoCheckKey = 'format' | 'size' | 'square' | 'shapes' | 'picture' | 'name'

export interface LogoCheck {
    key: LogoCheckKey;
    /** False fails the check. A warning passes (`ok: true, warn: true`) but asks for attention. */
    ok: boolean;
    warn?: boolean;
    message: string;
}

export interface LogoCheckResult {
    /** Set when the content is a readable PNG or SVG. */
    format?: LogoFormat;
    width?: number;
    height?: number;
    checks: LogoCheck[];
    suggestedFileName: string;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const SHAPE_TAGS = ['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'use']
const XLINK_NS = 'http://www.w3.org/1999/xlink'
const RASTER_DATA_URI = /^\s*data:image\/(png|jpe?g)/i

const startsWith = (bytes: Uint8Array, prefix: number[]) => prefix.every((b, i) => bytes[i] === b)
const readUint32 = (bytes: Uint8Array, at: number) => ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0
const kb = (size: number) => Math.ceil(size / 1024)
const thousands = (n: number) => n.toLocaleString('en-US')

function sizeCheck(size: number): LogoCheck {
    return size <= MAX_LOGO_BYTES
        ? { key: 'size', ok: true, message: `${kb(size)} KB (under 250 KB)` }
        : { key: 'size', ok: false, message: `${kb(size)} KB, over the 250 KB limit` }
}

function squareCheck(width?: number, height?: number): LogoCheck {
    if (width === undefined || height === undefined) {
        return { key: 'square', ok: true, warn: true, message: "Can't tell if it's square. Make sure it is." }
    }
    return width === height
        ? { key: 'square', ok: true, message: `Square, ${width} × ${height}` }
        : { key: 'square', ok: false, message: `Not square: ${width} × ${height}` }
}

function nameCheck(fileName: string, suggested: string): LogoCheck {
    return fileName === suggested
        ? { key: 'name', ok: true, message: `File name ${suggested}` }
        : { key: 'name', ok: true, warn: true, message: `Name it ${suggested} when you upload it` }
}

const positive = (value: string | null): number | undefined => {
    if (value === null) return undefined
    const n = parseFloat(value)
    // Percentages say nothing about the shape.
    return Number.isFinite(n) && n > 0 && !value.trim().endsWith('%') ? n : undefined
}

/** The SVG's drawing size: the viewBox first, else the width/height attributes. */
function svgSize(root: Element): { width?: number; height?: number } {
    const viewBox = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
    if (viewBox && viewBox.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0) {
        return { width: viewBox[2], height: viewBox[3] }
    }
    return { width: positive(root.getAttribute('width')), height: positive(root.getAttribute('height')) }
}

function parseSvg(text: string): Element | undefined {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
    const root = doc.documentElement
    if (!root || doc.getElementsByTagName('parsererror').length > 0 || root.localName !== 'svg') return undefined
    return root
}

/**
 * Checks a logo against the registry's rules.
 * @param bytes the file's bytes (at most {@link MAX_READ_BYTES} of them)
 * @param fileName the chosen file's name
 * @param display the token's display unit, for the suggested file name
 * @param size the whole file's size, when only part of it was read
 */
export function checkLogo(bytes: Uint8Array, fileName: string, display: string, size: number = bytes.length): LogoCheckResult {
    const fail = (message: string): LogoCheckResult => ({
        checks: [{ key: 'format', ok: false, message }, sizeCheck(size)],
        suggestedFileName: suggestLogoFileName(display, 'svg'),
    })

    if (startsWith(bytes, PNG_SIGNATURE)) {
        // IHDR is the first chunk: width and height at bytes 16–23, big-endian.
        if (bytes.length < 24) return fail("This PNG can't be read")
        const width = readUint32(bytes, 16)
        const height = readUint32(bytes, 20)
        const suggestedFileName = suggestLogoFileName(display, 'png')
        return {
            format: 'png',
            width,
            height,
            checks: [
                { key: 'format', ok: true, message: 'PNG' },
                sizeCheck(size),
                squareCheck(width, height),
                nameCheck(fileName, suggestedFileName),
            ],
            suggestedFileName,
        }
    }

    if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
        const renamed = /\.png$/i.test(fileName) ? ', renamed to .png' : ''
        return fail(`This is a JPG${renamed}. The registry only takes PNG or SVG.`)
    }

    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    if (!/<svg[\s>]/i.test(text)) return fail('Only PNG or SVG files work.')

    const suggestedFileName = suggestLogoFileName(display, 'svg')
    if (size > MAX_READ_BYTES) {
        // Too big to parse; the size check already fails it.
        return { format: 'svg', checks: [{ key: 'format', ok: true, message: 'SVG, preferred' }, sizeCheck(size)], suggestedFileName }
    }

    const root = parseSvg(text)
    if (!root) return fail("This SVG can't be read")

    const { width, height } = svgSize(root)
    const shapes = SHAPE_TAGS.reduce((n, tag) => n + root.getElementsByTagNameNS('*', tag).length, 0)
    const wrapsPicture = Array.from(root.getElementsByTagNameNS('*', 'image')).some(img => {
        const href = img.getAttribute('href') ?? img.getAttributeNS(XLINK_NS, 'href') ?? img.getAttribute('xlink:href') ?? ''
        return RASTER_DATA_URI.test(href)
    })

    return {
        format: 'svg',
        width,
        height,
        checks: [
            { key: 'format', ok: true, message: 'SVG, preferred' },
            sizeCheck(size),
            squareCheck(width, height),
            shapes < MAX_SVG_SHAPES
                ? { key: 'shapes', ok: true, message: `${thousands(shapes)} ${shapes === 1 ? 'shape' : 'shapes'} (under 1,000)` }
                : { key: 'shapes', ok: false, message: `Too detailed: ${thousands(shapes)} shapes, the registry allows under 1,000` },
            wrapsPicture
                ? { key: 'picture', ok: false, message: 'This SVG only wraps a picture. Use the PNG instead, or real vector art.' }
                : { key: 'picture', ok: true, message: 'Real vector art' },
            nameCheck(fileName, suggestedFileName),
        ],
        suggestedFileName,
    }
}

/** A logo can be used when it is a PNG or SVG and no check failed (warnings are fine). */
export function logoPasses(result: LogoCheckResult): boolean {
    return result.format !== undefined && result.checks.every(c => c.ok)
}
