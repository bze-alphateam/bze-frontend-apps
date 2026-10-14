// Distinct, valid bze1… addresses for list tests (BIP-173 bech32 over a 20-byte payload).

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values: number[]): number {
    let chk = 1;
    for (const v of values) {
        const top = chk >>> 25;
        chk = ((chk & 0x1ffffff) << 5) ^ v;
        GEN.forEach((g, i) => {
            if ((top >>> i) & 1) chk ^= g;
        });
    }
    return chk;
}

function toWords(bytes: number[]): number[] {
    const words: number[] = [];
    let acc = 0;
    let bits = 0;
    for (const b of bytes) {
        acc = (acc << 8) | b;
        bits += 8;
        while (bits >= 5) {
            bits -= 5;
            words.push((acc >>> bits) & 31);
        }
    }
    if (bits > 0) words.push((acc << (5 - bits)) & 31);
    return words;
}

function encode(hrp: string, bytes: number[]): string {
    const data = toWords(bytes);
    const expanded = [...hrp].map(c => c.charCodeAt(0) >> 5).concat(0, [...hrp].map(c => c.charCodeAt(0) & 31));
    const mod = polymod([...expanded, ...data, 0, 0, 0, 0, 0, 0]) ^ 1;
    const checksum = Array.from({ length: 6 }, (_, i) => (mod >>> (5 * (5 - i))) & 31);
    return `${hrp}1${[...data, ...checksum].map(d => CHARSET[d]).join("")}`;
}

/** `n` distinct valid BeeZee addresses. */
export function bzeWallets(n: number): string[] {
    return Array.from({ length: n }, (_, i) =>
        encode("bze", Array.from({ length: 20 }, (_, j) => (j < 2 ? (i >> (8 * (1 - j))) & 0xff : (j * 7 + 13) & 0xff))));
}
