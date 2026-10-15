import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { ValidatorSDKType } from "@bze/bzejs/cosmos/staking/v1beta1/staking";

const { replaceMock, searchParamsMock } = vi.hoisted(() => ({
    replaceMock: vi.fn(),
    searchParamsMock: { current: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace: replaceMock }),
    usePathname: () => "/",
    useSearchParams: () => searchParamsMock.current,
}));

import { StakeLinkHandler } from "./stake-link-handler";

const ALICE = "bzevaloper130k7xuf6tgessh76kpdr0z4j6fndhqjag8hjnu";
const VALIDATORS = [{ operator_address: ALICE, description: { moniker: "Alice Node" } }] as unknown as ValidatorSDKType[];

function renderHandler(openDelegate = vi.fn()) {
    render(
        <StakeLinkHandler
            validators={VALIDATORS}
            isConnected
            isConnecting={false}
            isConnectPromptOpen={false}
            openDelegate={openDelegate}
            openConnectPrompt={vi.fn()}
            highlight={vi.fn()}
            notify={vi.fn()}
        />,
    );
    return openDelegate;
}

beforeEach(() => {
    replaceMock.mockReset();
});

describe("StakeLinkHandler", () => {
    it("reads the stake parameter and removes it from the URL without scrolling", () => {
        searchParamsMock.current = new URLSearchParams(`stake=${ALICE}`);
        const openDelegate = renderHandler();

        expect(openDelegate).toHaveBeenCalledWith(VALIDATORS[0]);
        expect(replaceMock).toHaveBeenCalledWith("/", { scroll: false });
    });

    it("keeps other query parameters", () => {
        searchParamsMock.current = new URLSearchParams(`ref=x&stake=${ALICE}`);
        renderHandler();

        expect(replaceMock).toHaveBeenCalledWith("/?ref=x", { scroll: false });
    });
});
