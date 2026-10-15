"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Box, Button, HStack, Image, List, Text, VStack } from '@chakra-ui/react'
import { LuCheck, LuCircleAlert, LuUpload, LuX } from 'react-icons/lu'
import type { LogoFormat } from '@/lib/registry-entry'
import { type LogoCheck, type LogoCheckResult, MAX_READ_BYTES, checkLogo, logoPasses } from '@/lib/logo-check'

export interface LogoReady {
    format: LogoFormat;
    fileName: string;
}

interface LogoStepProps {
    /** The token's display unit, for the suggested file name. */
    display: string;
    /** The saved answer, when the step is reopened. */
    initial?: Partial<LogoReady>;
    onReady: (ready: LogoReady) => void;
}

interface Checked {
    fileName: string;
    result: LogoCheckResult;
    /** Object URL of the logo for the preview, shown only through <img> so an SVG's scripts never run. */
    previewUrl?: string;
}

const readBytes = (file: File): Promise<Uint8Array> => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file.slice(0, MAX_READ_BYTES))
})

function CheckRow({ check }: { check: LogoCheck }) {
    const result = !check.ok ? 'fail' : check.warn ? 'warn' : 'ok'
    const color = result === 'fail' ? 'red.fg' : result === 'warn' ? 'orange.fg' : 'green.fg'
    const Icon = result === 'fail' ? LuX : result === 'warn' ? LuCircleAlert : LuCheck
    return (
        <List.Item display="flex" alignItems="start" gap={2} data-testid={`logo-check-${check.key}`} data-result={result}>
            <Box color={color} pt="2px" flexShrink={0}><Icon size={14} /></Box>
            <Text fontSize="sm" wordBreak="break-word">{check.message}</Text>
        </List.Item>
    )
}

function Preview({ url }: { url: string }) {
    return (
        <HStack gap={3} data-testid="logo-preview">
            {[{ bg: 'white', label: 'On a light wallet' }, { bg: 'gray.900', label: 'On a dark wallet' }].map(side => (
                <Box key={side.label} p={2} borderRadius="full" bg={side.bg} borderWidth="1px" borderColor="border.muted">
                    <Image src={url} alt={side.label} boxSize="56px" borderRadius="full" objectFit="cover" />
                </Box>
            ))}
        </HStack>
    )
}

/**
 * Step 1 of the registry guide: the logo checker. It reads the chosen file in the browser
 * (nothing is uploaded) and checks it against the registry's rules. Only the format and the
 * file name leave this step, through `onReady`; the file itself is never stored.
 */
export function LogoStep({ display, initial, onReady }: LogoStepProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [checked, setChecked] = useState<Checked>()
    const [dragging, setDragging] = useState(false)
    const previewUrl = checked?.previewUrl

    useEffect(() => () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl)
    }, [previewUrl])

    const check = async (file: File) => {
        const bytes = await readBytes(file)
        const result = checkLogo(bytes, file.name, display, file.size)
        const canPreview = result.format !== undefined && file.size <= MAX_READ_BYTES
        const type = result.format === 'svg' ? 'image/svg+xml' : 'image/png'
        setChecked({
            fileName: file.name,
            result,
            previewUrl: canPreview ? URL.createObjectURL(new Blob([bytes as BlobPart], { type })) : undefined,
        })
    }

    const reset = () => {
        setChecked(undefined)
        if (inputRef.current) inputRef.current.value = ''
    }

    const passes = checked !== undefined && logoPasses(checked.result)

    return (
        <VStack align="stretch" gap={4}>
            <List.Root fontSize="sm" color="fg.muted" ps={5} gap={1}>
                <List.Item>Square, under 250 KB.</List.Item>
                <List.Item>PNG or SVG only. SVG is preferred: sharp at every size. No JPG, not even renamed.</List.Item>
                <List.Item>An SVG must be real vector art with under 1,000 shapes, not a picture wrapped in SVG.</List.Item>
                <List.Item>A lower-case file name.</List.Item>
            </List.Root>

            <input
                ref={inputRef}
                type="file"
                accept=".png,.svg,image/png,image/svg+xml"
                data-testid="logo-file"
                aria-label="Logo file"
                style={{ display: 'none' }}
                onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void check(file)
                }}
            />

            {!checked ? (
                <VStack
                    gap={2}
                    p={6}
                    borderWidth="2px"
                    borderStyle="dashed"
                    borderRadius="xl"
                    borderColor={dragging ? 'yellow.500' : 'border.muted'}
                    bg={dragging ? 'yellow.500/10' : 'bg.subtle'}
                    textAlign="center"
                    onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                        e.preventDefault()
                        setDragging(false)
                        const file = e.dataTransfer.files?.[0]
                        if (file) void check(file)
                    }}
                >
                    <LuUpload size={20} />
                    <Text fontSize="sm">Drop your logo here</Text>
                    <Button size="sm" variant="outline" colorPalette="yellow" onClick={() => inputRef.current?.click()}>
                        Choose a file
                    </Button>
                    {initial?.fileName && (
                        <Text fontSize="xs" color="fg.muted">{`Last time you checked ${initial.fileName}.`}</Text>
                    )}
                </VStack>
            ) : (
                <VStack align="stretch" gap={3}>
                    <HStack gap={4} align="start" flexWrap="wrap">
                        {previewUrl && <Preview url={previewUrl} />}
                        <VStack align="start" gap={0} minW={0}>
                            <Text fontSize="sm" fontWeight="medium" wordBreak="break-all">{checked.fileName}</Text>
                            <Text fontSize="xs" color="fg.muted">Checked in your browser, nothing is uploaded.</Text>
                        </VStack>
                    </HStack>
                    <List.Root gap={1} aria-label="Logo checks">
                        {checked.result.checks.map(c => <CheckRow key={c.key} check={c} />)}
                    </List.Root>
                    <HStack gap={2} flexWrap="wrap">
                        <Button
                            colorPalette="yellow"
                            size="sm"
                            disabled={!passes}
                            onClick={() => {
                                if (checked.result.format) onReady({ format: checked.result.format, fileName: checked.result.suggestedFileName })
                            }}
                        >
                            Mark as done
                        </Button>
                        <Button size="sm" variant="ghost" onClick={reset}>Choose another file</Button>
                    </HStack>
                </VStack>
            )}

            {!checked && (
                <Text fontSize="xs" color="fg.muted">Checked in your browser, nothing is uploaded.</Text>
            )}
        </VStack>
    )
}
