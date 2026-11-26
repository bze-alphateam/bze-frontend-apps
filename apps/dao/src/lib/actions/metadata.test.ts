import {describe, expect, it} from "vitest";
import {packDaoMsgs} from "@bze/bze-ui-kit";
import {tryDescribe} from "../propose/describe";
import {ctxWith, DAO, DAO_ADDRESS} from "@/test/composer-fixtures";
import {metadataEntry} from "./metadata";

const fields = (over: Record<string, string> = {}) => ({name: "Hive council", description: "Runs the hive.", ...over});

describe("the rename action", () => {
    it("starts from the current name and description", () => {
        expect(metadataEntry.initialFields(ctxWith())).toEqual({name: DAO.name, description: DAO.description});
    });

    it("builds the message the DAO signs, both fields always sent", () => {
        const msg = metadataEntry.build(fields(), ctxWith());
        expect(msg.typeUrl).toBe("/bze.dao.MsgUpdateMetadata");
        expect(msg.value).toMatchObject({authority: DAO_ADDRESS, daoId: 4n, name: "Hive council", description: "Runs the hive."});
        expect(packDaoMsgs([msg])).toHaveLength(1);
    });

    it("sends an empty description to clear it, and trims what was typed", () => {
        const msg = metadataEntry.build(fields({name: "  Hive council  ", description: "   "}), ctxWith());
        expect(msg.value).toMatchObject({name: "Hive council", description: ""});
    });

    it("accepts the longest name and description and refuses one byte more", () => {
        expect(metadataEntry.validate(fields({name: "a".repeat(64), description: "b".repeat(2000)}), ctxWith())).toBeUndefined();
        expect(metadataEntry.validate(fields({name: "a".repeat(65)}), ctxWith())).toMatch(/at most 64 bytes/);
        expect(metadataEntry.validate(fields({description: "b".repeat(2001)}), ctxWith())).toMatch(/at most 2,000 bytes/);
    });

    it("counts bytes, not letters", () => {
        expect(metadataEntry.validate(fields({name: "é".repeat(32)}), ctxWith())).toBeUndefined();
        expect(metadataEntry.validate(fields({name: "é".repeat(33)}), ctxWith())).toMatch(/at most 64 bytes/);
    });

    it("refuses an empty name and a change that changes nothing", () => {
        expect(metadataEntry.validate(fields({name: "  "}), ctxWith())).toBe("Enter a name.");
        expect(metadataEntry.validate({name: DAO.name, description: DAO.description}, ctxWith())).toMatch(/same as today/);
    });

    it("is read back as a rename, not raw JSON", () => {
        const read = tryDescribe(metadataEntry.build(fields(), ctxWith()), DAO, (c) => c.amount);
        expect(read).toEqual({ok: true, action: {type: "update_metadata", name: "Hive council", description: "Runs the hive."}});
    });
});
