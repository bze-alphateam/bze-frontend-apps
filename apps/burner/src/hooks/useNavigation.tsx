import {usePathname, useRouter} from "next/navigation";

// Basic navigation without search params (no Suspense needed)
export const useNavigation = () => {
    const router = useRouter();
    const pathname = usePathname();

    return {
        currentPathName: pathname,
        navigate: router.push,
    };
};