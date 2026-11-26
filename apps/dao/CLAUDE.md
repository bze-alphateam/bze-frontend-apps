# BZE DAO (dao.getbze.com)

Next.js frontend for the BeeZee chain's x/dao module (chain v8.3.0). React 19, Chakra UI v3.

> Commands, env vars, patches, deploy: the **repo root README.md** owns all of that. This file is architecture only.

## Architecture

All shared code comes from `@bze/bze-ui-kit` (the x/dao queries, message builders, validation and tally rules live in `query/dao.ts` and `utils/dao/`). Same shell as staking: an app-specific `AssetsProvider` extends the lib's base `AssetsContextType`, Hive Glow system with the DAO accent (`createHiveGlowSystem('dao')`), shared `AppHeader` with the nav items "DAOs" (`/`) and "Create" (`/create`, reserved for the create flow).

```
src/
  app/              # pages: `/` (home), `/dao/[id]` (the DAO page, BFE-372) and `/proposal/[id]` (the proposal page, BFE-373), `/create` (coming soon) + app/api/scan (proxy)
  components/
    dao/page/       # the DAO page: dao-page (loading + tabs), header, panels (control, treasury, rules), voters-panels (who votes, how to join), my-power, history-tab, panel (shared bits)
    dao/            # home page parts: home (composition), all-daos (type filter, search, Load more), my-daos, open-proposals, explainer, dao-card, unsupported
    dao/page/proposals-tab.tsx   # the DAO page's Proposals tab (Active / Finished)
    proposal/       # the proposal page: proposal-page (loading + composition), status-pill, tally-panel, actions-panel, timeline-money, votes-panel, my-vote, actions-slot (the transaction buttons, BFE-374)
    ui/             # provider, colour mode, navbar, inner hero, plain-text (untrusted text)
  contexts/assets_context.tsx   # DAO AssetsProvider — extends lib's base AssetsContextType
  hooks/            # useAsync (key-derived loading, no setState in effects), useDaoList (first page + Load more), useDaoContext, navigation, chain listener
  lib/
    scan-proxy.ts   # server side of /api/scan: only the DAO routes, per-route query allowlist (repeated params kept), finished DAO proposals kept forever
    dao-scan.ts     # client of the proxy: listDaos / openProposals / filtersSupported probe; getter injected
    dao-loader.ts   # the home page's reads with their fallbacks (loadDaoPage, loadMyDaos, loadOpenProposals); Scan and chain injected as interfaces
    dao-chain.ts    # composition root: ui-kit's chain queries + the browser Scan client
    dao-view-loader.ts  # the DAO page's reads (loadDaoView: chain; loadDaoExtras / loadHistoryPage / loadMyVotes: Scan); chain and Scan injected, secondary reads settle as Part<T>
    dao-page-scan.ts    # Scan client of the page: daos/{id}, daos/{id}/history, dao-votes?voter=
    dao-control.ts, dao-rules.ts, dao-power.ts, dao-history.ts, dao-voters.ts, dao-actions.ts, dao-text.ts   # pure text/state helpers of the page (control chain, rules in words, voting-power messages, history renderer, sources, action flags, plain-text linkify)
    proposal-model.ts, proposal-loader.ts, dao-proposal-scan.ts, proposal-types.ts   # one proposal model for both sides (chain / Scan), the page's reads (chain and Scan injected), Scan client + DTOs
    proposal-status.ts, proposal-tally.ts, proposal-describe.ts, proposal-timeline.ts, proposal-money.ts, proposal-votes.ts   # pure: status words, the bars (ui-kit tally rules), message describers, timeline, cost/deposit text
    proposal-actions.ts, proposal-cleanup.ts, dao-tx.ts   # what a wallet can do on a proposal (pure), the clean-up loop, the signing wrapper with `daoTxOptions` (BFE-374)
    dao-cards.ts, my-daos.ts, staker-sources.ts, format.ts, dao-types.ts   # pure helpers
```

## Data

- **Lists come from BZE Scan** (`/api/v1/daos`, `/api/v1/dao-proposals`) through the app's own `/api/scan` route (Scan sends no CORS headers for this app). Scan's `type` values are `static_list` / `stake`; proposal statuses are lower-case chain names.
- **Fallbacks**: Scan down → the All DAOs list reads the chain's `/bze/dao/daos` (no filters, no open counts, the filter runs on the page) with a notice; "My DAOs" always keeps the administered DAOs from the chain (`daos_by_admin`). Scan's `supported: false`, or the chain's `isDaoModuleSupported()` false while Scan is down, is the one friendly "arrive with v8.3.0" state. A chain network failure is an error, never "not supported".
- **Scan filters of BFE-368** (`member`, `source`, `q`, the cross-DAO `dao-proposals` list): a Scan without them *ignores* the unknown parameters and answers the whole list, so `filtersSupported()` probes once with an invalid `member` address (a newer Scan answers 400, an older one 200). Without them My DAOs lists only the administered DAOs (with a notice), the name search runs on the loaded page and the open-proposals feed is hidden.
- **My DAOs** = administered (chain) ∪ `member` (Scan) ∪ `source` (Scan, the wallet's x/rewards positions as `sr/{reward_id}` / `dr/{staking_denom}`, 20 per request). One row per DAO with every reason ("Admin", "Member", "Staker"); self-owned DAOs are never "Admin".

## Tests

Vitest next to the code (`src/**/*.test.ts`, pure helpers through their public API, collaborators injected). Playwright e2e in `e2e/` (CI only, workflow `e2e-dao`): fixtures for the chain, aggregator and Scan answer fake `*.e2e.test` hosts; a fake Keplr (`e2e/support/fake-keplr.ts`) connects a wallet. See `e2e/README.md`.

## The DAO page

- **Live state is always the chain** (`dao/{id}`, `params`, `dao_controller`, `dao_by_address` to name admin-chain DAOs, bank balances for the treasury, open proposals, the staking reward / Denom Reward of each source, `voting_power`). Scan adds only the creator, labels, the history and the wallet's votes (`dao-votes?voter=`, no DAO filter on Scan's side: pages are read up to a cap and filtered here). A chain miss on the DAO is "not found" (a non-numeric id too, without any request); a Scan miss never is.
- **Failures stay local**: each secondary chain read settles as a `Part` (the panel says it could not be read), each Scan part has a Retry.
- **Action buttons** (new proposal, request to join / leave, admin console) sit behind `DAO_FEATURES` in `lib/dao-actions.ts`; turn a flag on in the story that ships the target page. Until then nothing is rendered.
- DAO name and description are untrusted: plain text, line breaks kept, links only through `safeHttpUrl` (http/https) in `lib/dao-text.ts`; never HTML.

## The proposal pages (BFE-373)

- **Source of truth**: while the chain has the proposal (`/bze/dao/proposal/{id}`: status, tally, pinned rules, `voting_ended`, `retry_deadline`, `expedite_settleable`) it is the chain; Scan only adds what the chain does not keep (settle height, execution error, deposit release, cleanup) as a retryable part. A chain 404 is the cleanup: the proposal is read from Scan alone and marked **Archived**; both 404 is "not found"; a chain miss with Scan down throws (cannot tell cleaned-up from never-existed). `useProposalPage` polls the chain in place every 60 s while it is voting and the tab is visible; a failed poll keeps what is shown.
- **Bars** come from the pinned config and `pinned_denominator` through ui-kit's tally rules (`lib/proposal-tally.ts`); "met" is never derived from the shown percentages. The share achieved rounds down, the bar it has to reach rounds up, so the text never claims more than the rule.
- **Untrusted text** (title, summary, decoded message fields) is plain text: `PlainText` linkifies http(s) only; the summary is not Markdown here (a deliberate narrowing of the ticket: no new dependency and no HTML path). Unknown messages are shown as raw JSON in a `<pre>`.
- **A config update** is shown against the rules pinned at submission (`before` = the proposal's `pinned_config`), since a diff against the live config is empty once it executed.
- **Lists**: Scan lists one status per request, so Active = `voting` + `execution_failed` merged newest first (chain fallback: both statuses in one request); Finished = the unfiltered newest-first list with the moving and placeholder rows dropped (Scan down: a retry).

## Proposal actions (BFE-374)

- **`lib/proposal-actions.ts` decides, the slot only draws.** `proposalActions({model, wallet, myVote, params, gas, nowMs})` returns which of vote / vote-and-settle / settle (retry, mark expired) / cancel / clean up are offered and enabled, each with its reason. Every unknown input (ballot read failed, eligible weight null, params unreadable, balance still loading) is its own state: it disables with "could not be read", never "no power". "Voting ended" and "settleable" are the chain's flags; the browser clock only picks Retry vs Mark expired (the chain decides by block time) and the stake-DAO early-settle delay.
- **Tally rules are ui-kit's.** Vote and settle = `daoExpediteTally` on the live tally with the wallet's old ballot taken out and its eligible weight added to YES (offered only for an expedited proposal that is not already settleable early, never after a weighted YES, never before a stake DAO's `min_expedite_delay`). The settle outcome is `tallyView(...).passesRegular`.
- **Signing**: `sendDaoTx(tx, msgs)` always passes `daoTxOptions` (direct sign, abort on simulation error) and turns the result into a `TxOutcome`; `unconfirmed` (a confirmation timeout, or a failure after the broadcast with no chain code) means the transaction may still land. `useActionFlow` runs one action at a time and **locks** the actions after an unconfirmed outcome (hash shown, "Check again" re-reads the proposal) or after a success whose re-read failed.
- **After a transaction** `useProposalPage().refresh()` re-reads the chain in place (`reloadProposalAfterTx`: any chain failure is "failed", only a 404 is "gone" and reloads into the Archived view) and bumps `version`, which re-reads the wallet's ballot/power (`mine`, read once in the page and shared with My vote) and the votes list.
- **Clean-up** repeats `MsgCleanupProposal` (limit 0) until the chain no longer has the proposal (a tx result with `completed` does not reach the app, so the 404 is the signal); a batch that cannot be confirmed or a chain that cannot be read stops the loop, never ends it as done.
- **Fee check**: a wallet with neither a native nor a fee-token balance is blocked with the reason; the simulation judges everything else.
- Ledger: DAO transactions are direct-signed, so the panel carries one faint line saying a Ledger cannot approve them yet (decision of BFE-366, canvas board E7).
