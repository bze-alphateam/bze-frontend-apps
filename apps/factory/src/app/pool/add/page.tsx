"use client"

import React from 'react'
import { FormPage } from '@/components/guided'
import { MovedToDex } from '@/components/pool-wizard/moved-to-dex'

export default function PoolAddPage() {
    return (
        <FormPage>
            <MovedToDex />
        </FormPage>
    )
}
