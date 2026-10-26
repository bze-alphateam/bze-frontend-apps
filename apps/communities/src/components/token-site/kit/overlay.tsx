'use client';

import React, {useEffect, useRef} from "react";
import {createPortal} from "react-dom";
import {Box, chakra, Flex} from "@chakra-ui/react";
import {LuX} from "react-icons/lu";

import {useTokenSiteTheme} from "./theme";
import {ts, tsMix} from "./tokens";

interface OverlayProps {
    open: boolean;
    onClose: () => void;
    /** Accessible name and visible heading. */
    title: string;
    /** Shown before the heading (e.g. the token's mark). */
    icon?: React.ReactNode;
    children: React.ReactNode;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Keeps Tab and Shift+Tab inside `container` (the layer is modal). */
function trapTab(event: KeyboardEvent, container: HTMLElement) {
    const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) {
        event.preventDefault();
        container.focus();
        return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    const outside = !container.contains(active);
    if (event.shiftKey && (active === first || active === container || outside)) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
    }
}

interface LayerProps extends OverlayProps {
    placement: "right" | "center";
}

/**
 * The portaled layer behind `TsDrawer` and `TsDialog`. It renders under `document.body`, outside
 * the `TokenSiteTheme` element, so it re-applies the theme variables on its own root.
 */
function OverlayLayer({open, onClose, title, icon, children, placement}: LayerProps) {
    const {vars} = useTokenSiteTheme();
    const panel = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const opener = document.activeElement as HTMLElement | null;
        panel.current?.focus();

        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
            if (event.key === "Tab" && panel.current) trapTab(event, panel.current);
        };
        document.addEventListener("keydown", onKey);

        return () => {
            document.removeEventListener("keydown", onKey);
            // Back to whatever opened the layer, as long as it is still on the page.
            if (opener?.isConnected) opener.focus();
        };
    }, [open, onClose]);

    if (!open || typeof document === "undefined") return null;

    const isDrawer = placement === "right";

    return createPortal(
        <Box
            data-testid="token-site-layer"
            style={vars as React.CSSProperties}
            position="fixed"
            inset="0"
            zIndex="modal"
            color={ts.fg}
            fontFamily={ts.font}
        >
            <Box position="absolute" inset="0" bg={`color-mix(in oklab, ${ts.fg} 40%, transparent)`} onClick={onClose} aria-hidden="true"/>
            <Flex
                ref={panel}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                direction="column"
                gap="20px"
                position="absolute"
                bg={ts.bg}
                overflowY="auto"
                outline="none"
                p="24px"
                {...(isDrawer
                    ? {
                        top: "0", right: "0", bottom: "0", w: {base: "100%", md: "420px"},
                        borderLeftWidth: "1px", borderStyle: "solid", borderColor: ts.border,
                        borderRadius: {base: "0", md: "16px 0 0 16px"},
                        boxShadow: "-30px 0 80px -40px rgba(0, 0, 0, 0.6)",
                    }
                    : {
                        top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                        w: "calc(100% - 32px)", maxW: "480px", maxH: "calc(100% - 32px)", borderRadius: "20px",
                        borderWidth: "1px", borderStyle: "solid", borderColor: ts.border,
                        gap: "14px",
                        boxShadow: "0 40px 100px -40px rgba(0, 0, 0, 0.7)",
                    })}
            >
                <Flex align="center" justify="space-between" gap="12px">
                    <Flex align="center" gap="10px" minW="0">
                        {icon}
                        <chakra.h2 m="0" fontSize={{base: "18px", md: "20px"}} fontWeight={700}>{title}</chakra.h2>
                    </Flex>
                    <chakra.button
                        type="button"
                        aria-label="Close"
                        onClick={onClose}
                        display="inline-flex"
                        alignItems="center"
                        justifyContent="center"
                        w="44px"
                        h="44px"
                        flexShrink={0}
                        borderRadius="12px"
                        borderWidth="1px"
                        borderStyle="solid"
                        borderColor={tsMix(ts.fg, 18)}
                        bg="transparent"
                        color={ts.fg}
                        cursor="pointer"
                    >
                        <LuX aria-hidden="true"/>
                    </chakra.button>
                </Flex>
                {children}
            </Flex>
        </Box>,
        document.body,
    );
}

/** Right-hand drawer (420 px, full width on phones), e.g. the wallet. */
export function TsDrawer(props: OverlayProps) {
    return <OverlayLayer {...props} placement="right"/>;
}

/** Centred dialog, e.g. stake or burn confirmations. */
export function TsDialog(props: OverlayProps) {
    return <OverlayLayer {...props} placement="center"/>;
}
