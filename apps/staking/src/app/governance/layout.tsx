import type {Metadata} from "next";

export const metadata: Metadata = {
    title: "Governance | BeeZee Staking",
    description: "See the BeeZee network's governance proposals and vote on them with your staked BZE.",
};

export default function GovernanceLayout({children}: {children: React.ReactNode}) {
    return children;
}
