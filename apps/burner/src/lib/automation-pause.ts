import type {TendermintEvent} from "@bze/bze-ui-kit";

/** Emitted on the blockchain event manager when the guardian paused or governance resumed the automation. */
export const AUTOMATION_PAUSE_CHANGED_EVENT = "automation_pause_changed";

/**
 * Whether a tx event or a block event (finalize_block_events) is the guardian pausing or resuming
 * the automation. A pause is a tx event when the guardian signs and a block event when governance
 * does; a resume always comes from a passed proposal, so a block event.
 */
export const isAutomationPauseEvent = (event: TendermintEvent): boolean =>
    event.type.includes('bze.guardian.v1.AutomationPausedEvent')
    || event.type.includes('bze.guardian.v1.AutomationResumedEvent');
