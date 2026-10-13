'use client';

import React, {useEffect, useRef, useState} from "react";
import {chakra, Flex} from "@chakra-ui/react";
import {LuArrowLeft} from "react-icons/lu";
import {
    type Asset,
    type BeeZeeEndpoints,
    CONNECTION_TYPE_NONE,
    CONNECTION_TYPE_POLLING,
    CONNECTION_TYPE_WS,
    type ConnectionType,
    convertToWebSocketUrl,
    type EndpointValidationResults,
    useConnectionType,
    useSettings,
    validateEndpoints,
} from "@bze/bze-ui-kit";

import {useColorMode} from "@/components/ui/color-mode";
import {useFeeMode} from "@/hooks/token-site/useTokenFeeMode";

import {TsButton, TsCard, TsField, ts, tsLabel, tsMix} from "../kit";

const STATUS: Record<ConnectionType, { label: string; color: string }> = {
    [CONNECTION_TYPE_WS]: {label: "Connected", color: ts.sec},
    [CONNECTION_TYPE_POLLING]: {label: "Polling", color: tsMix(ts.sec, 45, ts.pri)},
    [CONNECTION_TYPE_NONE]: {label: "Failed", color: ts.pri},
};

function Group({title, aside, children}: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
    return (
        <TsCard as="section" aria-label={title} px="18px" py="16px" borderRadius="16px" display="flex" flexDirection="column" gap="14px">
            <Flex align="center" justify="space-between" gap="12px">
                <chakra.h3 m="0" {...tsLabel}>{title}</chakra.h3>
                {aside}
            </Flex>
            {children}
        </TsCard>
    );
}

/** An on/off row of the settings panel. */
function SwitchRow({id, label, hint, checked, onChange}: {
    id: string;
    label: string;
    hint?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <Flex align="center" justify="space-between" gap="12px">
            <Flex direction="column" gap="2px">
                <chakra.span id={id} fontWeight={600}>{label}</chakra.span>
                {hint && <chakra.span id={`${id}-hint`} fontSize="13px" color={ts.muted}>{hint}</chakra.span>}
            </Flex>
            <chakra.button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-labelledby={id}
                aria-describedby={hint ? `${id}-hint` : undefined}
                onClick={() => onChange(!checked)}
                position="relative"
                w="52px"
                h="30px"
                flexShrink={0}
                p="0"
                border="0"
                borderRadius="999px"
                cursor="pointer"
                bg={checked ? ts.pri : tsMix(ts.fg, 18)}
                _focusVisible={{outline: `2px solid ${ts.fg}`, outlineOffset: "2px"}}
            >
                <chakra.span
                    aria-hidden="true"
                    position="absolute"
                    top="3px"
                    left={checked ? "25px" : "3px"}
                    w="24px"
                    h="24px"
                    borderRadius="50%"
                    bg={checked ? ts.onPri : ts.bg}
                    transition="left 0.15s ease"
                />
            </chakra.button>
        </Flex>
    );
}

function DarkModeSwitch() {
    const {colorMode, setColorMode} = useColorMode();
    const isDark = colorMode === "dark";

    return <SwitchRow id="settings-dark-mode" label="Dark mode" checked={isDark} onChange={(dark) => setColorMode(dark ? "dark" : "light")}/>;
}

/**
 * "Pay network fees in T" (Business Logic R13): on by default, shown only while T can pay them.
 * Turning it off pays in BZE, remembered for this token.
 */
function FeeModeSettings({asset}: { asset: Asset }) {
    const {eligible, optOut, setOptOut} = useFeeMode();
    if (!eligible) return null;

    return (
        <Group title="Network fees">
            <SwitchRow
                id="settings-fee-mode"
                label={`Pay network fees in ${asset.ticker}`}
                checked={!optOut}
                onChange={(payInToken) => setOptOut(!payInToken)}
            />
        </Group>
    );
}

function EndpointResult({id, kind, result}: { id: string; kind: string; result: EndpointValidationResults["rest"] }) {
    if (!result) return null;

    return (
        <chakra.span
            id={id}
            role={result.isValid ? "status" : "alert"}
            fontSize="13px"
            px="4px"
            color={result.isValid ? ts.fg : ts.pri}
        >
            {result.isValid ? `${kind} endpoint is valid` : (result.error || `${kind} endpoint is not valid`)}
        </chakra.span>
    );
}

function ConnectionSettings() {
    const {settings, updateEndpoints, defaultSettings} = useSettings();
    const {connectionType} = useConnectionType();
    const [rest, setRest] = useState(settings.endpoints.restEndpoint);
    const [rpc, setRpc] = useState(settings.endpoints.rpcEndpoint);
    const [results, setResults] = useState<EndpointValidationResults>({});
    const [isChecking, setIsChecking] = useState(false);
    const [saved, setSaved] = useState(false);

    // The stored endpoints can load (or change) after the panel opens: follow them, during render.
    const [seenEndpoints, setSeenEndpoints] = useState(settings.endpoints);
    if (settings.endpoints !== seenEndpoints) {
        setSeenEndpoints(settings.endpoints);
        setRest(settings.endpoints.restEndpoint);
        setRpc(settings.endpoints.rpcEndpoint);
    }

    const edit = (setter: (value: string) => void) => (event: React.ChangeEvent<HTMLInputElement>) => {
        setter(event.target.value);
        setResults({});
        setSaved(false);
    };

    /** Checks both endpoints and shows the outcome; true when both work. */
    const check = async (): Promise<boolean> => {
        setIsChecking(true);
        setResults({});
        setSaved(false);
        try {
            const outcome = await validateEndpoints(rest.trim(), rpc.trim());
            setResults({rest: outcome.rest, rpc: outcome.rpc});
            return outcome.isValid;
        } catch {
            setResults({rest: {isValid: false, error: "Validation failed"}, rpc: {isValid: false, error: "Validation failed"}});
            return false;
        } finally {
            setIsChecking(false);
        }
    };

    const store = (endpoints: BeeZeeEndpoints) => {
        if (updateEndpoints(endpoints)) setSaved(true);
    };

    const save = async () => {
        if (!(await check())) return;
        store({restEndpoint: rest.trim(), rpcEndpoint: convertToWebSocketUrl(rpc.trim())});
    };

    const reset = () => {
        const defaults = defaultSettings.endpoints;
        setRest(defaults.restEndpoint);
        setRpc(defaults.rpcEndpoint);
        setResults({});
        store(defaults);
    };

    const status = STATUS[connectionType];
    const isEmpty = rest.trim() === "" || rpc.trim() === "";
    const isUnchanged = rest === settings.endpoints.restEndpoint && rpc === settings.endpoints.rpcEndpoint;

    return (
        <Group
            title="Connection"
            aside={(
                <chakra.span data-testid="settings-connection-status" display="inline-flex" alignItems="center" gap="6px" fontSize="13px" fontWeight={600}>
                    <chakra.span aria-hidden="true" w="8px" h="8px" borderRadius="50%" bg={status.color}/>
                    {status.label}
                </chakra.span>
            )}
        >
            <TsField
                label="REST endpoint"
                placeholder="https://rest.getbze.com"
                fontSize="15px"
                autoComplete="off"
                spellCheck={false}
                value={rest}
                onChange={edit(setRest)}
                aria-invalid={results.rest ? !results.rest.isValid : undefined}
                aria-describedby="settings-rest-help"
            />
            <chakra.span id="settings-rest-help" mt="-8px" px="4px" fontSize="13px" color={ts.muted}>Must allow browser requests (CORS).</chakra.span>
            <EndpointResult id="settings-rest-result" kind="REST" result={results.rest}/>

            <TsField
                label="RPC endpoint"
                placeholder="wss://rpc.getbze.com"
                fontSize="15px"
                autoComplete="off"
                spellCheck={false}
                value={rpc}
                onChange={edit(setRpc)}
                aria-invalid={results.rpc ? !results.rpc.isValid : undefined}
                aria-describedby="settings-rpc-help"
            />
            <chakra.span id="settings-rpc-help" mt="-8px" px="4px" fontSize="13px" color={ts.muted}>Must accept WebSocket (ws/wss) connections.</chakra.span>
            <EndpointResult id="settings-rpc-result" kind="RPC" result={results.rpc}/>

            <TsButton variant="ghost" onClick={check} disabled={isEmpty || isChecking}>
                {isChecking ? "Checking…" : "Validate"}
            </TsButton>
            <TsButton variant="primary" onClick={save} disabled={isEmpty || isUnchanged || isChecking}>Save</TsButton>
            <TsButton variant="ghost" onClick={reset} disabled={isChecking}>Reset to defaults</TsButton>
            {saved && <chakra.span role="status" fontSize="13px" px="4px" textAlign="center">Settings saved</chakra.span>}
        </Group>
    );
}

/**
 * The token site's settings (Business Logic R13): dark mode, paying fees in T and the BeeZee endpoints, a second view
 * of the wallet drawer. Same storage as the rest of the app, so the directory sees these too.
 */
export function SettingsPanel({asset, onBack}: { asset: Asset; onBack: () => void }) {
    // The button that opened the panel is gone: keep the keyboard inside the drawer.
    const panel = useRef<HTMLDivElement>(null);
    useEffect(() => panel.current?.querySelector<HTMLButtonElement>("button[aria-label='Back to wallet']")?.focus(), []);

    return (
        <Flex ref={panel} direction="column" gap="16px" data-testid="wallet-settings">
            <Flex align="center" gap="10px">
                <TsButton variant="ghost" onClick={onBack} aria-label="Back to wallet" w="44px" px="0">
                    <LuArrowLeft aria-hidden="true"/>
                </TsButton>
                <chakra.h3 m="0" fontSize="18px" fontWeight={700}>Settings</chakra.h3>
            </Flex>
            <Group title="Appearance">
                <DarkModeSwitch/>
            </Group>
            <FeeModeSettings asset={asset}/>
            <ConnectionSettings/>
        </Flex>
    );
}
