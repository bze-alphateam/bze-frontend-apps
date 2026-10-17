import type {Metadata} from "next";

export async function generateMetadata({params}: {params: Promise<{id: string}>}): Promise<Metadata> {
    const {id} = await params;
    return {
        title: `Proposal #${id} | BeeZee Staking`,
        description: "What this BeeZee governance proposal does, its live tally and how to vote with your staked BZE.",
    };
}

export default function ProposalLayout({children}: {children: React.ReactNode}) {
    return children;
}
