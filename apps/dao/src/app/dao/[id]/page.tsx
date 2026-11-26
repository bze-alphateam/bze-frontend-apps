'use client';

import {use} from "react";
import {DaoPage} from "@/components/dao/page/dao-page";

export default function Page({params}: {params: Promise<{id: string}>}) {
    const {id} = use(params);
    return <DaoPage id={id} />;
}
