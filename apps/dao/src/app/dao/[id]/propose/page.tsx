'use client';

import {use} from "react";
import {ProposePage} from "@/components/propose/propose-page";

export default function Page({params}: {params: Promise<{id: string}>}) {
    const {id} = use(params);
    return <ProposePage id={id} />;
}
