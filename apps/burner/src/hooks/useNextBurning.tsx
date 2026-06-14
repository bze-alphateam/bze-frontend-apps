import {useBurnerContext} from "./useBurnerContext";

export function useNextBurning() {
    const {nextBurn, isLoading, updateNextBurn} = useBurnerContext()

    return {
        nextBurn,
        isLoading,
        reload: updateNextBurn,
    };
}
