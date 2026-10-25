"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Box, Button, HStack, Image, List, Text, VStack } from '@chakra-ui/react'
import { LuCheck, LuCircleAlert, LuUpload, LuX } from 'react-icons/lu'
import { hgVariant } from '@bze/bze-ui-kit'
import { softButton } from '@/components/ui/soft-button'
import type { LogoFormat } from '@/lib/registry-entry'
import { type LogoCheck, type LogoCheckResult, MAX_READ_BYTES, checkLogo, logoPasses } from '@/lib/logo-check'

export interface LogoReady {
    format: LogoFormat;
    fileName: string;
    /** For the step's summary: the drawing size and the file size in bytes. */
    width?: number;
    height?: number;
    bytes?: number;
}

interface LogoStepProps {
    /** The token's display unit, for the suggested file name. */
    display: string;
    /** The saved answer, when the step is reopened. */
    initial?: Partial<LogoReady>;
    onReady: (ready: LogoReady) => void;
}

interface Chosen {
    fileName: string;
    size: number;
    bytes: Uint8Array;
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
    const color = result === 'fail' ? 'hg.danger' : result === 'warn' ? 'hg.warning' : 'hg.success'
    const Icon = result === 'fail' ? LuX : result === 'warn' ? LuCircleAlert : LuCheck
    return (
        <List.Item display="flex" alignItems="start" gap={2} data-testid={`logo-check-${check.key}`} data-result={result}>
            <Box color={color} pt="2px" flexShrink={0}><Icon size={14} /></Box>
            <Text fontSize="13px" wordBreak="break-word">{check.message}</Text>
        </List.Item>
    )
}

function Preview({ url }: { url: string }) {
    return (
        <HStack gap={3} data-testid="logo-preview">
            {/* Stand-ins for a wallet's own background, so they stay white and black in either mode. */}
            {[{ bg: 'white', label: 'On a light wallet' }, { bg: 'black', label: 'On a dark wallet' }].map(side => (
                <Box key={side.label} p="6px" borderRadius="full" bg={side.bg} borderWidth="1px" borderColor="hg.lineStrong">
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
    const [chosen, setChosen] = useState<Chosen>()
    const [dragging, setDragging] = useState(false)
    const previewUrl = chosen?.previewUrl
    // Checked on every render: the display unit behind the suggested name can arrive after the
    // file was chosen (the metadata loads on its own).
    const result: LogoCheckResult | undefined = chosen && checkLogo(chosen.bytes, chosen.fileName, display, chosen.size)

    useEffect(() => () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl)
    }, [previewUrl])

    const check = async (file: File) => {
        const bytes = await readBytes(file)
        const { format } = checkLogo(bytes, file.name, display, file.size)
        const canPreview = format !== undefined && file.size <= MAX_READ_BYTES
        const type = format === 'svg' ? 'image/svg+xml' : 'image/png'
        setChosen({
            fileName: file.name,
            size: file.size,
            bytes,
            previewUrl: canPreview ? URL.createObjectURL(new Blob([bytes as BlobPart], { type })) : undefined,
        })
    }

    const reset = () => {
        setChosen(undefined)
        if (inputRef.current) inputRef.current.value = ''
    }

    const passes = result !== undefined && logoPasses(result)

    return (
        <VStack align="stretch" gap={4}>
            <List.Root fontSize="sm" color="fg.muted" ps={5} gap={1}>
                <List.Item>Square, under 250 KB.</List.Item>
                <List.Item>PNG or SVG (preferred). No JPG, not even renamed.</List.Item>
                <List.Item>An SVG: real vector art, under 1000 shapes.</List.Item>
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

            {!chosen || !result ? (
                <VStack
                    gap="10px"
                    p="24px"
                    borderWidth="1.5px"
                    borderStyle="dashed"
                    borderRadius="14px"
                    borderColor={dragging ? 'app.focusRing' : 'app.border'}
                    bg={dragging ? 'app.subtle' : 'app.subtle/25'}
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
                    <Box color="hg.link" aria-hidden><LuUpload size={22} /></Box>
                    <Text fontSize="14px">Drop your logo here</Text>
                    <Button {...softButton} size="sm" onClick={() => inputRef.current?.click()}>
                        Choose a file
                    </Button>
                    {initial?.fileName && (
                        <Text fontSize="12px" color="hg.text.faint">{`Last time you checked ${initial.fileName}.`}</Text>
                    )}
                </VStack>
            ) : (
                <VStack align="stretch" gap="12px" p="16px" borderRadius="14px" borderWidth="1px" borderColor="hg.hairline" bg="hg.inset">
                    <HStack gap="12px" align="center" flexWrap="wrap">
                        {previewUrl && <Preview url={previewUrl} />}
                        <VStack align="start" gap={0} minW={0}>
                            <Text fontSize="13px" fontWeight="700" wordBreak="break-all">{chosen.fileName}</Text>
                            <Text fontSize="11px" color="hg.text.faint">Checked in your browser, nothing is uploaded.</Text>
                        </VStack>
                    </HStack>
                    <List.Root gap={1} aria-label="Logo checks">
                        {result.checks.map(c => <CheckRow key={c.key} check={c} />)}
                    </List.Root>
                    <HStack gap="8px" flexWrap="wrap">
                        <Button
                            variant={hgVariant('primary')}
                            size="sm"
                            disabled={!passes}
                            onClick={() => {
                                if (result.format) onReady({ format: result.format, fileName: result.suggestedFileName, width: result.width, height: result.height, bytes: chosen?.size })
                            }}
                        >
                            Mark as done
                        </Button>
                        <Button size="sm" variant="ghost" color="hg.text.secondary" fontWeight="600" onClick={reset}>Choose another file</Button>
                    </HStack>
                </VStack>
            )}

            {!chosen && (
                <Text fontSize="12px" color="hg.text.faint">Checked in your browser, nothing is uploaded.</Text>
            )}
        </VStack>
    )
}
