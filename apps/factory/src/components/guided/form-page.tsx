"use client"

import React, { Suspense } from 'react'
import { Box } from '@chakra-ui/react'
import { Shimmer } from '@bze/bze-ui-kit'
import { FormFrame } from './guided-form'

/**
 * The outer frame of a guided form page: full height, with the Suspense boundary the form needs
 * (it reads search params). The form draws its own hero and content band.
 */
export function FormPage({ children }: { children: React.ReactNode }) {
    return (
        <Box minH="100vh">
            <Suspense fallback={<FormFrame><Shimmer h="384px" borderRadius="hg.lg" /></FormFrame>}>
                {children}
            </Suspense>
        </Box>
    )
}
