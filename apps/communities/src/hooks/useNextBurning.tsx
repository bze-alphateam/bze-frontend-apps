import {useCommunitiesContext} from "./useCommunitiesContext";

/**
 * The next scheduled burning (coins currently queued in the burner module address
 * plus the scheduled date), sourced from the communities assets context.
 */
export function useNextBurning() {
    const {nextBurn, isLoading, updateNextBurn} = useCommunitiesContext();

    return {
        nextBurn,
        isLoading,
        reload: updateNextBurn,
    };
}
