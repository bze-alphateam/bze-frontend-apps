import type {Metadata} from "next";

// Unlisted helper page: no navigation entry, kept out of search engines.
export const metadata: Metadata = {
    title: "AtomOne withdraw address | BeeZee Staking",
    description: "Change the address your AtomOne staking rewards are paid to.",
    robots: {index: false, follow: false},
};

export default function AtomOneWithdrawAddressLayout({children}: {children: React.ReactNode}) {
    return children;
}
