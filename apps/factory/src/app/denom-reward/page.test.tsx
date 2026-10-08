import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import type { Asset } from "@bze/bze-ui-kit";

// The directory against mocked chain queries: the DR list plus per-DR prize and schedule lists.
const { getAllMock, getPrizesMock, getSchedulesMock, navigateMock } = vi.hoisted(() => ({
    getAllMock: vi.fn(),
    getPrizesMock: vi.fn(),
    getSchedulesMock: vi.fn(),
    navigateMock: vi.fn(),
}));

vi.mock("@/hooks/useNavigation", () => ({ useNavigation: () => ({ navigate: navigateMock }) }));
vi.mock("@/components/ui/asset-picker", () => ({
    AssetPicker: ({ onSelect }: { onSelect: (a: { denom: string }) => void }) => (
        <button onClick={() => onSelect({ denom: "uatom" })}>pick ATOM</button>
    ),
}));
vi.mock("@bze/bze-ui-kit", async (importActual) => {
    const actual = await importActual<typeof import("@bze/bze-ui-kit")>();
    const assets: Record<string, Partial<Asset>> = {
        ubze: { denom: "ubze", ticker: "BZE", name: "BeeZee", decimals: 6, logo: "" },
        "factory/bze1owner/utok": { denom: "factory/bze1owner/utok", ticker: "TOK", name: "Token", decimals: 6, logo: "" },
    };
    return {
        ...actual,
        useAsset: (denom: string) => ({ asset: assets[denom], isLoading: false }),
        getAllDenomRewards: () => getAllMock(),
        getDenomRewardPrizes: (denom: string) => getPrizesMock(denom),
        getDenomRewardSchedules: (denom: string) => getSchedulesMock(denom),
    };
});

import DenomRewardDirectoryPage from "./page";

const DRS = [
    { staking_denom: "ubze", lock: 7, min_stake: "0", staked_amount: "1500000000" },
    { staking_denom: "factory/bze1owner/utok", lock: 1, min_stake: "0", staked_amount: "0" },
];

const list = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i }));

function renderPage() {
    return render(<DenomRewardDirectoryPage />, {
        wrapper: ({ children }: { children: ReactNode }) => (
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        ),
    });
}

beforeEach(() => {
    getAllMock.mockReset();
    getPrizesMock.mockReset();
    getSchedulesMock.mockReset();
    navigateMock.mockReset();
});

describe("denom reward directory", () => {
    it("lists every DR with total staked, prize and running-schedule counts and the lock", async () => {
        getAllMock.mockResolvedValue(DRS);
        getPrizesMock.mockImplementation(async (d: string) => (d === "ubze" ? list(3) : list(0)));
        getSchedulesMock.mockImplementation(async (d: string) => (d === "ubze" ? list(2) : list(0)));
        renderPage();

        const rows = await screen.findAllByTestId("denom-reward-row");
        expect(rows).toHaveLength(2);

        const bze = within(rows[0]);
        expect(bze.getByText("BZE")).toBeInTheDocument();
        expect(bze.getByText("1,500 BZE")).toBeInTheDocument();
        expect(bze.getByText("7 days")).toBeInTheDocument();
        await waitFor(() => expect(bze.getByText("3")).toBeInTheDocument());
        expect(bze.getByText("2")).toBeInTheDocument();

        const tok = within(rows[1]);
        expect(tok.getByText("0 TOK")).toBeInTheDocument();
        expect(tok.getByText("1 day")).toBeInTheDocument();
        await waitFor(() => expect(tok.getAllByText("0")).toHaveLength(2));
    });

    it("opens the public denom reward page of a row, slash denoms encoded", async () => {
        getAllMock.mockResolvedValue(DRS);
        getPrizesMock.mockResolvedValue([]);
        getSchedulesMock.mockResolvedValue([]);
        renderPage();

        const rows = await screen.findAllByTestId("denom-reward-row");
        await userEvent.click(rows[1]);
        expect(navigateMock).toHaveBeenLastCalledWith("/denom-reward/token?denom=factory%2Fbze1owner%2Futok");
    });

    it("opens any token picked in the search, also one without a DR yet", async () => {
        getAllMock.mockResolvedValue([]);
        renderPage();

        expect(await screen.findByTestId("denom-reward-empty")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "pick ATOM" }));
        expect(navigateMock).toHaveBeenLastCalledWith("/denom-reward/token?denom=uatom");
    });

    it("shows a dash for the counts of a DR whose queries fail", async () => {
        getAllMock.mockResolvedValue([DRS[0]]);
        getPrizesMock.mockRejectedValue(new Error("boom"));
        getSchedulesMock.mockResolvedValue([]);
        vi.spyOn(console, "error").mockImplementation(() => {});
        renderPage();

        const [row] = await screen.findAllByTestId("denom-reward-row");
        await waitFor(() => expect(within(row).getAllByText("—")).toHaveLength(2));
    });

    it("reports a failed list query and retries it", async () => {
        getAllMock.mockRejectedValueOnce(new Error("501")).mockResolvedValueOnce([DRS[0]]);
        getPrizesMock.mockResolvedValue([]);
        getSchedulesMock.mockResolvedValue([]);
        vi.spyOn(console, "error").mockImplementation(() => {});
        renderPage();

        expect(await screen.findByText("Couldn't load the denom rewards")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /Retry/ }));
        expect(await screen.findAllByTestId("denom-reward-row")).toHaveLength(1);
        expect(getAllMock).toHaveBeenCalledTimes(2);
    });
});
