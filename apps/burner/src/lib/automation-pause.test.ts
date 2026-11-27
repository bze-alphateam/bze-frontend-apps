import {describe, expect, it} from "vitest";
import {isAutomationPauseEvent} from "./automation-pause";

describe("isAutomationPauseEvent", () => {
    it("matches the guardian's paused and resumed events", () => {
        expect(isAutomationPauseEvent({type: "bze.guardian.v1.AutomationPausedEvent", attributes: []})).toBe(true);
        expect(isAutomationPauseEvent({type: "bze.guardian.v1.AutomationResumedEvent", attributes: []})).toBe(true);
    });

    it("ignores other events", () => {
        expect(isAutomationPauseEvent({type: "bze.burner.CoinsBurnedEvent", attributes: []})).toBe(false);
    });
});
