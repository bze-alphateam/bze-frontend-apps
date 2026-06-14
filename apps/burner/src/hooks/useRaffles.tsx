import {useMemo} from "react";
import { useBurnerContext } from "./useBurnerContext";

export function useRaffles() {
    const { raffles: rafflesMap, isLoading, updateRaffles } = useBurnerContext();

    const raffles = useMemo(() => {
        return Array.from(rafflesMap.values());
    }, [rafflesMap]);

    return {
        raffles,
        isLoading,
        reload: updateRaffles,
    };
}

export function useRaffle(denom: string) {
    const { raffles, isLoading, raffleWinners } = useBurnerContext();

    const raffle = useMemo(() => {
        if (!denom) return undefined;

        return raffles.get(denom)
    }, [denom, raffles])

    const winners = useMemo(() => {
        if (!denom) return [];
        return raffleWinners.get(denom) || [];
    }, [raffleWinners, denom]);

    return {
        raffle,
        isLoading,
        winners,
    }
}

export function useRaffleContributions() {
    const {
        pendingRaffleContributions,
        addPendingRaffleContribution,
        removePendingRaffleContribution,
        markRaffleContributionAsClosed
    } = useBurnerContext();

    const getPendingContribution = useMemo(() => {
        return (denom: string) => pendingRaffleContributions.get(denom);
    }, [pendingRaffleContributions]);

    return {
        addPendingRaffleContribution,
        getPendingContribution,
        markAsClosed: markRaffleContributionAsClosed,
        removePendingContribution: removePendingRaffleContribution,
    }
}
