import {useEffect} from 'react';
import type {SubmitState} from './useProposalSubmit';

/**
 * When a submit is done, runs `onDone` once and goes to the new proposal; without an id (the proposal exists
 * but its id could not be read) it stays, and the page says where to find it.
 */
export function useProposalRedirect(state: SubmitState, push: (path: string) => void, onDone: () => void): void {
    useEffect(() => {
        if (state.phase !== 'done') return;
        onDone();
        if (state.proposalId) push(`/proposal/${state.proposalId}`);
    }, [state, push, onDone]);
}
