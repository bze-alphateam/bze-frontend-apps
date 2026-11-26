'use client';

import {use} from "react";
import {ProposalPage} from "@/components/proposal/proposal-page";

export default function ProposalRoute({params}: {params: Promise<{id: string}>}) {
    const {id} = use(params);
    return <ProposalPage id={id} />;
}
