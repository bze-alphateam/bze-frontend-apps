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
    children: React.ReactNode;
}

interface LayerProps extends OverlayProps {
    placement: "right" | "center";
}

/**
 * The portaled layer behind `TsDrawer` and `TsDialog`. It renders under `document.body`, outside
 * the `TokenSiteTheme` element, so it re-applies the theme variables on its own root.
 */
function OverlayLayer({open, onClose, title, children, placement}: LayerProps) {
    const {vars} = useTokenSiteTheme();
    const panel = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        panel.current?.focus();

        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);

        return () => document.removeEventListener("keydown", onKey);
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
                    ? {top: "0", right: "0", bottom: "0", w: {base: "100%", md: "420px"}, borderLeftWidth: "1px", borderStyle: "solid", borderColor: ts.border}
                    : {
                        top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                        w: "calc(100% - 40px)", maxW: "480px", maxH: "calc(100% - 40px)", borderRadius: "20px",
                    })}
            >
                <Flex align="center" justify="space-between" gap="12px">
                    <chakra.h2 m="0" fontSize="20px" fontWeight={700}>{title}</chakra.h2>
                    <chakra.button
                        type="button"
                        aria-label="Close"
                        onClick={onClose}
                        display="inline-flex"
                        alignItems="center"
                        justifyContent="center"
                        w="44px"
                        h="44px"
                        borderRadius="999px"
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
