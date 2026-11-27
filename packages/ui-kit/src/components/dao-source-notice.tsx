'use client'

import {Text} from '@chakra-ui/react';
import type {ReactNode} from 'react';
import {getDaoApp} from '../constants/ecosystem';
import {useDaoSourceUsage} from '../hooks/useDaoSourceUsage';
import type {DaoSourceUsage} from '../query/dao_source_usage';
import {Notice} from './hive-glow/status';

/** What the user is about to do in the staking source. A first join and a top-up read the same. */
export type DaoSourceNoticeAction = 'stake' | 'exit';

export interface DaoSourceNoticeContent {
    /** `warning`: open proposals are affected; `muted`: only the fact that DAOs vote with this stake. */
    tone: 'warning' | 'muted';
    body: ReactNode;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const DaoNames = ({usage}: {usage: DaoSourceUsage}) => {
    // the DAO app's origin, when the ecosystem list has one
    const base = (() => {
        try {
            return getDaoApp()?.href.replace(/\/+$/, '') || '';
        } catch {
            return '';
        }
    })();

    return (
        <>
            {usage.daos.map((dao, i) => (
                <span key={dao.id}>
                    {i > 0 && ', '}
                    {base
                        ? <a href={`${base}/dao/${encodeURIComponent(dao.id)}`} target="_blank" rel="noopener noreferrer" style={{fontWeight: 600, textDecoration: 'underline'}}>{dao.name}</a>
                        : <strong>{dao.name}</strong>}
                </span>
            ))}
        </>
    );
}

/** The wording of the notice, or null when no DAO uses the source. Never blocks anything. */
export function buildDaoSourceNotice(usage: DaoSourceUsage, action: DaoSourceNoticeAction): DaoSourceNoticeContent | null {
    if (usage.daos.length === 0) return null;

    const dao = plural(usage.daos.length, 'DAO', 'DAOs');
    const n = usage.openProposals.length;
    if (n === 0) {
        // nothing is open: stake joined now or removed later only matters to the next proposals
        if (action === 'exit') return null;
        return {tone: 'muted', body: <>This program&apos;s stake votes in {dao} <DaoNames usage={usage}/>.</>};
    }

    const proposals = `${n} open ${plural(n, 'proposal', 'proposals')}`;
    return {
        tone: 'warning',
        body: action === 'stake'
            ? <>This program&apos;s stake votes in {dao} <DaoNames usage={usage}/>. Stake you add now won&apos;t count on its {proposals}, and a top-up makes your whole stake here stop counting on them. Vote first, then add.</>
            : <>Leaving now lowers your votes on {proposals} of {dao} <DaoNames usage={usage}/>, and joining again won&apos;t bring them back.</>,
    };
}

export interface DaoSourceNoticeProps {
    /** `sr/{reward_id}` or `dr/{staking_denom}`; nothing renders without one. */
    source: string | undefined;
    action: DaoSourceNoticeAction;
    /** Draws the notice in the app's own style; the default is the shared status notice. */
    render?: (content: DaoSourceNoticeContent) => ReactNode;
}

/** Warns, never blocks, that joining, topping up or leaving a staking source changes the user's DAO votes. */
export const DaoSourceNotice = ({source, action, render}: DaoSourceNoticeProps) => {
    const usage = useDaoSourceUsage(source);
    const content = buildDaoSourceNotice(usage, action);
    if (!content) return null;

    if (render) return <>{render(content)}</>;
    return content.tone === 'warning'
        ? <div data-testid="dao-source-notice" data-tone="warning"><Notice status="warning">{content.body}</Notice></div>
        : <Text fontSize="13px" color="fg.muted" data-testid="dao-source-notice" data-tone="muted">{content.body}</Text>;
}
