'use client'

import {
    VStack,
    HStack,
    Text,
    Switch,
    Button,
    Separator,
    Box,
    Input,
    createListCollection,
} from '@chakra-ui/react'
import { Select, Portal } from '@chakra-ui/react'
import { useTheme } from "next-themes"
import {useState, useEffect, useMemo, useCallback} from 'react'
import { useSettings } from '../../hooks/useSettings'
import {convertToWebSocketUrl, validateEndpoints} from '../../utils/validation'
import {
    CONNECTION_TYPE_NONE,
    CONNECTION_TYPE_POLLING,
    CONNECTION_TYPE_WS,
} from '../../types/settings'
import type { EndpointValidationResults } from '../../types/settings'
import {useToast} from "../../hooks/useToast"
import {useConnectionType} from "../../hooks/useConnectionType"
import {useFeeTokens} from "../../hooks/useFeeTokens"
import {getChainNativeAssetDenom} from "../../constants/assets"
import {Notice, StatusPill, type NoticeStatus} from "../hive-glow/status"
import {hgVariant} from "../../theme/variants"
import {DrawerHelper, DrawerSectionTitle} from "./drawer-kit"

export const SettingsSidebarContent = () => {
    const { setTheme, resolvedTheme} = useTheme()
    const {toast} = useToast()
    const { settings, isLoaded, updateEndpoints, updatePreferredFeeDenom, defaultSettings } = useSettings()
    const {connectionType} = useConnectionType()
    const { feeTokens, isLoading: feeTokensLoading } = useFeeTokens()

    // Local form state
    const [restEndpoint, setRestEndpoint] = useState('')
    const [rpcEndpoint, setRpcEndpoint] = useState('')
    const [isValidating, setIsValidating] = useState(false)
    const [validationResults, setValidationResults] = useState<EndpointValidationResults>({})
    const [preferredFeeDenom, setPreferredFeeDenom] = useState<string | undefined>(undefined)

    // Initialize form with loaded settings
    useEffect(() => {
        if (isLoaded) {
            setRestEndpoint(settings.endpoints.restEndpoint)
            setRpcEndpoint(settings.endpoints.rpcEndpoint)
            setPreferredFeeDenom(settings.preferredFeeDenom || getChainNativeAssetDenom())
        }
    }, [isLoaded, settings])

    const handleValidateEndpoints = useCallback(async (rest: string, rpc: string) => {
        setIsValidating(true)
        setValidationResults({})

        try {
            const results = await validateEndpoints(rest, rpc)
            setValidationResults({
                rest: results.rest,
                rpc: results.rpc
            })
        } catch (error) {
            console.error(error)
            setValidationResults({
                rest: { isValid: false, error: 'Validation failed' },
                rpc: { isValid: false, error: 'Validation failed' }
            })
        } finally {
            setIsValidating(false)
            setTimeout(() => setValidationResults({}), 10_000)
        }
    }, [])

    const handleSaveSettings = useCallback(async (rest: string, rpc: string, feeDenom?: string) => {
        setValidationResults({})
        const results = await validateEndpoints(rest, rpc)
        if (!results.isValid) {
            setValidationResults({
                rest: results.rest,
                rpc: results.rpc
            })

            setTimeout(() => setValidationResults({}), 10_000)

            return
        }

        const endpointsSuccess = updateEndpoints({
            restEndpoint: rest.trim(),
            rpcEndpoint: convertToWebSocketUrl(rpc.trim())
        })

        const feeTokenSuccess = updatePreferredFeeDenom(feeDenom)

        if (endpointsSuccess && feeTokenSuccess) {
            toast.success('Success!', 'Settings have been saved.')
        }
    }, [updateEndpoints, updatePreferredFeeDenom, toast])

    const handleResetToDefaults = useCallback(() => {
        setRestEndpoint(defaultSettings.endpoints.restEndpoint)
        setRpcEndpoint(defaultSettings.endpoints.rpcEndpoint)
        setPreferredFeeDenom(defaultSettings.preferredFeeDenom)
        setValidationResults({})
    }, [defaultSettings])

    const connectionStatusText = useMemo(() => {
        switch(connectionType) {
            case CONNECTION_TYPE_NONE:
                return 'Failed'
            case CONNECTION_TYPE_POLLING:
                return 'Polling'
            case CONNECTION_TYPE_WS:
                return 'Connected'
        }
    }, [connectionType])

    const connectionStatusTone = useMemo<NoticeStatus>(() => {
        switch(connectionType) {
            case CONNECTION_TYPE_NONE:
                return 'danger'
            case CONNECTION_TYPE_POLLING:
                return 'warning'
            case CONNECTION_TYPE_WS:
            default:
                return 'success'
        }
    }, [connectionType])

    // Create fee tokens collection for select
    const feeTokensCollection = useMemo(() => createListCollection({
        items: feeTokens.map(token => ({
            label: token.ticker || token.name,
            value: token.denom,
            name: token.ticker || token.name,
        }))
    }), [feeTokens])

    const handleFeeTokenChange = useCallback((denom: string) => {
        setPreferredFeeDenom(denom || undefined)
    }, [])

    const hasUnsavedChanges =
        restEndpoint !== settings.endpoints.restEndpoint ||
        rpcEndpoint !== settings.endpoints.rpcEndpoint ||
        preferredFeeDenom !== settings.preferredFeeDenom

    const fieldLabel = (text: string) => (
        <Text fontSize="13px" fontWeight="600" color="hg.text.secondary">{text}</Text>
    )

    const validationNotice = (result: { isValid: boolean; error?: string } | undefined, validText: string) => result && (
        <Box role="status">
            <Notice status={result.isValid ? 'success' : 'danger'}>{result.error || validText}</Notice>
        </Box>
    )

    return (
        <VStack gap="22px" align="stretch">
            {/* Appearance Section */}
            <VStack as="section" gap="6px" align="stretch">
                <DrawerSectionTitle>Appearance</DrawerSectionTitle>
                <Switch.Root
                    display="flex"
                    justifyContent="space-between"
                    minH="40px"
                    checked={resolvedTheme === 'dark'}
                    onCheckedChange={(details) => {
                        const newTheme = details.checked ? 'dark' : 'light'
                        setTheme(newTheme)
                    }}
                >
                    <Switch.Label fontSize="14px" fontWeight="400" color="fg">Dark Mode</Switch.Label>
                    <Switch.HiddenInput />
                    <Switch.Control bg="hg.switchOff" _checked={{ bgImage: 'appButton' }}>
                        <Switch.Thumb />
                    </Switch.Control>
                </Switch.Root>
            </VStack>

            <Separator borderColor="hg.divider" />

            {/* Fee Token Preference Section */}
            <VStack as="section" gap="8px" align="stretch">
                <DrawerSectionTitle>Fee Token Preference</DrawerSectionTitle>
                <Select.Root
                    collection={feeTokensCollection}
                    size="sm"
                    value={preferredFeeDenom ? [preferredFeeDenom] : ['']}
                    onValueChange={(details) => handleFeeTokenChange(details.value[0] || '')}
                    disabled={feeTokensLoading}
                >
                    <Select.Label fontSize="13px" fontWeight="600" color="hg.text.secondary">Preferred Fee Token</Select.Label>
                    <Select.HiddenSelect />
                    <Select.Control>
                        <Select.Trigger>
                            <Select.ValueText placeholder="Native Token (default)" />
                        </Select.Trigger>
                        <Select.IndicatorGroup>
                            <Select.Indicator />
                        </Select.IndicatorGroup>
                    </Select.Control>
                    <Portal>
                        <Select.Positioner>
                            <Select.Content>
                                {feeTokensCollection.items.map((item) => (
                                    <Select.Item key={item.value} item={item}>
                                        <Text>{item.label}</Text>
                                        <Select.ItemIndicator />
                                    </Select.Item>
                                ))}
                            </Select.Content>
                        </Select.Positioner>
                    </Portal>
                </Select.Root>
                <DrawerHelper>
                    Select your preferred token for paying transaction fees. Only tokens with liquidity pools paired with the native token are available.
                </DrawerHelper>
            </VStack>

            <Separator borderColor="hg.divider" />

            {/* BeeZee Endpoints Section */}
            <VStack as="section" gap="14px" align="stretch">
                <DrawerSectionTitle>BeeZee Endpoints</DrawerSectionTitle>

                <HStack justify="space-between" fontSize="14px" color="fg">
                    <Text>Status:</Text>
                    <StatusPill tone={connectionStatusTone}>{connectionStatusText}</StatusPill>
                </HStack>

                {/* REST Endpoint */}
                <VStack gap="6px" align="stretch">
                    {fieldLabel('REST Endpoint')}
                    <DrawerHelper>Note: Endpoint must have CORS enabled to work in browser</DrawerHelper>
                    <Input
                        size="sm"
                        fontFamily="mono"
                        aria-label="REST Endpoint"
                        placeholder="https://rest.getbze.com"
                        value={restEndpoint}
                        aria-invalid={validationResults.rest && !validationResults.rest.isValid ? true : undefined}
                        onChange={(e) => setRestEndpoint(e.target.value)}
                    />
                    {validationNotice(validationResults.rest, 'REST endpoint is valid')}
                </VStack>

                {/* RPC Endpoint */}
                <VStack gap="6px" align="stretch">
                    {fieldLabel('RPC Endpoint')}
                    <DrawerHelper>Note: Must support WebSocket (WS/WSS) connections</DrawerHelper>
                    <Input
                        size="sm"
                        fontFamily="mono"
                        aria-label="RPC Endpoint"
                        placeholder="wss://rpc.getbze.com"
                        value={rpcEndpoint}
                        aria-invalid={validationResults.rpc && !validationResults.rpc.isValid ? true : undefined}
                        onChange={(e) => setRpcEndpoint(e.target.value)}
                    />
                    {validationNotice(validationResults.rpc, 'RPC endpoint is valid')}
                </VStack>

                {/* Validation Button */}
                <Button
                    size="md"
                    variant={hgVariant('secondary')}
                    onClick={() => handleValidateEndpoints(restEndpoint, rpcEndpoint)}
                    loading={isValidating}
                    loadingText="Validating..."
                    disabled={!restEndpoint.trim() || !rpcEndpoint.trim()}
                >
                    Validate Endpoints
                </Button>
            </VStack>

            {/* Action Buttons */}
            <VStack gap="10px" align="stretch">
                <Button
                    size="lg"
                    width="full"
                    variant={hgVariant('primary')}
                    onClick={() => handleSaveSettings(restEndpoint, rpcEndpoint, preferredFeeDenom)}
                    disabled={!hasUnsavedChanges}
                >
                    Save Settings
                </Button>
                <Button
                    size="md"
                    width="full"
                    variant={hgVariant('secondary')}
                    onClick={handleResetToDefaults}
                >
                    Reset to Defaults
                </Button>
            </VStack>
        </VStack>
    )
}
