import {createHash} from "node:crypto";
import {createServer, type Server} from "node:http";
import type {Socket} from "node:net";

// A fake CometBFT RPC for the chain feed specs (BFE-291). Playwright's routeWebSocket patches
// the WebSocket of pages only, so it cannot see sockets opened inside a SharedWorker; this is a
// real WebSocket server on 127.0.0.1 instead. It speaks just enough of the protocol: text
// frames, `subscribe` acked with an empty result, then a NewBlock notification every second.

export interface FakeRpc {
    /** Base URL to store as the app's RPC endpoint, e.g. ws://127.0.0.1:41234 */
    url: string;
    /** WebSocket connections accepted so far. */
    connections(): number;
    /** `subscribe` requests received so far, for this query. */
    subscribes(query: string): number;
    /** Answer the next `subscribe` with a CometBFT "out of capacity" error instead of an ack. */
    cancelNextSubscribe(): void;
    close(): Promise<void>;
}

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const NEW_BLOCK = "tm.event='NewBlock'";

const encode = (text: string): Buffer => {
    const payload = Buffer.from(text);
    const length = payload.length;
    const header = length < 126
        ? Buffer.from([0x81, length])
        : length < 65536
            ? Buffer.from([0x81, 126, length >> 8, length & 0xff])
            : (() => { throw new Error("frame too large for the fake RPC"); })();
    return Buffer.concat([header, payload]);
};

/** Reads the client's masked text frames out of `buffer`; returns the messages and the rest. */
const decode = (buffer: Buffer): {messages: string[]; rest: Buffer} => {
    const messages: string[] = [];
    let offset = 0;
    while (buffer.length - offset >= 2) {
        const opcode = buffer[offset] & 0x0f;
        let length = buffer[offset + 1] & 0x7f;
        let cursor = offset + 2;
        if (length === 126) {
            if (buffer.length < cursor + 2) break;
            length = buffer.readUInt16BE(cursor);
            cursor += 2;
        } else if (length === 127) {
            if (buffer.length < cursor + 8) break;
            length = Number(buffer.readBigUInt64BE(cursor));
            cursor += 8;
        }
        if (buffer.length < cursor + 4 + length) break;
        const mask = buffer.subarray(cursor, cursor + 4);
        const payload = Buffer.from(buffer.subarray(cursor + 4, cursor + 4 + length));
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
        if (opcode === 0x1) messages.push(payload.toString("utf8"));
        offset = cursor + 4 + length;
    }
    return {messages, rest: buffer.subarray(offset)};
};

export const startFakeRpc = async (): Promise<FakeRpc> => {
    let connections = 0;
    let cancelNext = false;
    const subscribes = new Map<string, number>();
    const sockets = new Set<Socket>();
    const timers = new Set<NodeJS.Timeout>();

    const server: Server = createServer((_req, res) => {
        res.writeHead(426).end();
    });

    server.on("upgrade", (req, socket: Socket) => {
        const key = req.headers["sec-websocket-key"];
        if (typeof key !== "string") {
            socket.destroy();
            return;
        }
        connections++;
        sockets.add(socket);
        socket.on("close", () => sockets.delete(socket));
        socket.on("error", () => undefined);
        socket.write([
            "HTTP/1.1 101 Switching Protocols",
            "Upgrade: websocket",
            "Connection: Upgrade",
            `Sec-WebSocket-Accept: ${createHash("sha1").update(key + GUID).digest("base64")}`,
            "", "",
        ].join("\r\n"));

        let pending: Buffer = Buffer.alloc(0);
        let height = 1;
        socket.on("data", (chunk) => {
            const decoded = decode(Buffer.concat([pending, chunk]));
            pending = decoded.rest;
            for (const raw of decoded.messages) {
                const request = JSON.parse(raw) as {id: string; method: string; params?: {query?: string}};
                if (request.method !== "subscribe") continue;

                const query = request.params?.query ?? "";
                subscribes.set(query, (subscribes.get(query) ?? 0) + 1);

                if (cancelNext) {
                    cancelNext = false;
                    socket.write(encode(JSON.stringify({
                        jsonrpc: "2.0",
                        id: request.id,
                        error: {code: -32000, message: "Server error", data: "subscription was canceled (reason: out of capacity)"},
                    })));
                    continue;
                }

                socket.write(encode(JSON.stringify({jsonrpc: "2.0", id: request.id, result: {}})));
                if (query !== NEW_BLOCK) continue;

                const timer = setInterval(() => {
                    if (socket.destroyed) {
                        clearInterval(timer);
                        return;
                    }
                    socket.write(encode(JSON.stringify({
                        jsonrpc: "2.0",
                        id: request.id,
                        result: {query, data: {type: "tendermint/event/NewBlock", value: {block: {header: {height: String(height++)}}}}, events: {}},
                    })));
                }, 1_000);
                timers.add(timer);
            }
        });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("fake RPC did not bind a port");

    return {
        url: `ws://127.0.0.1:${address.port}`,
        connections: () => connections,
        subscribes: (query) => subscribes.get(query) ?? 0,
        cancelNextSubscribe: () => { cancelNext = true; },
        close: () => new Promise<void>((resolve) => {
            for (const timer of timers) clearInterval(timer);
            for (const socket of sockets) socket.destroy();
            server.close(() => resolve());
        }),
    };
};
