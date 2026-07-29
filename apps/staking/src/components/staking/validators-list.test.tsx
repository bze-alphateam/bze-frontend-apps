import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { ValidatorSDKType } from "@bze/bzejs/cosmos/staking/v1beta1/staking";

// The list reads `nativeAsset` off ui-kit's useAssets for decimals/ticker; the
// delegate modal it renders pulls in wallet/tx hooks, so we stub both out and
// keep the rest of ui-kit (prettyAmount, uAmountToBigNumberAmount, …) real.
const { useAssetsMock } = vi.hoisted(() => ({ useAssetsMock: vi.fn() }));

vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    return {
        ...actual,
        useAssets: () => useAssetsMock(),
    };
});

vi.mock("./delegate-modal", () => ({
    DelegateModal: () => null,
}));

import { ValidatorsList } from "./validators-list";

function validator(operator: string, moniker: string, tokens: string): ValidatorSDKType {
    return {
        operator_address: operator,
        tokens,
        jailed: false,
        description: { moniker },
        commission: { commission_rates: { rate: "0.05" } },
    } as unknown as ValidatorSDKType;
}

const VALIDATORS = [
    validator("bzevaloper1alice", "Alice Node", "3000000"),
    validator("bzevaloper1bob", "Bob Stake", "2000000"),
];

function renderList(validators: ValidatorSDKType[] = VALIDATORS) {
    return render(
        <ValidatorsList validators={validators} onActionComplete={vi.fn()} logos={{}} />,
        {
            wrapper: ({ children }: { children: ReactNode }) => (
                <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
            ),
        },
    );
}

beforeEach(() => {
    useAssetsMock.mockReset();
    useAssetsMock.mockReturnValue({
        nativeAsset: { denom: "ubze", ticker: "BZE", decimals: 6 },
    });
});

describe("ValidatorsList", () => {
    it("renders a card per validator with the running count and a Stake action each", () => {
        renderList();

        expect(screen.getByText(/All Validators \(2\)/)).toBeInTheDocument();
        expect(screen.getByText("Alice Node")).toBeInTheDocument();
        expect(screen.getByText("Bob Stake")).toBeInTheDocument();
        expect(screen.getAllByRole("button", { name: /Stake/ })).toHaveLength(2);
    });

    it("filters the list by moniker as the user types", async () => {
        const user = userEvent.setup();
        renderList();

        await user.type(screen.getByPlaceholderText(/Search validators/i), "alice");

        expect(screen.getByText("Alice Node")).toBeInTheDocument();
        expect(screen.queryByText("Bob Stake")).not.toBeInTheDocument();
    });

    it("shows the no-results message when nothing matches the search", async () => {
        const user = userEvent.setup();
        renderList();

        await user.type(screen.getByPlaceholderText(/Search validators/i), "zzz");

        expect(screen.getByText(/No validators found matching/)).toBeInTheDocument();
        expect(screen.queryByText("Alice Node")).not.toBeInTheDocument();
    });
});
