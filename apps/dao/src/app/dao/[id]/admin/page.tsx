'use client';

import {use} from "react";
import {AdminPage} from "@/components/admin/admin-page";

export default function Page({params}: {params: Promise<{id: string}>}) {
    const {id} = use(params);
    return <AdminPage id={id} />;
}
