'use client';

import React from "react";
import {chakra, type HTMLChakraProps} from "@chakra-ui/react";

import {ts, tsMix} from "./tokens";

export type TsButtonVariant = "primary" | "secondary" | "ghost";

const VARIANTS = {
    primary: {bg: ts.pri, color: ts.onPri, borderColor: ts.pri},
    secondary: {bg: ts.sec, color: ts.onSec, borderColor: ts.sec},
    ghost: {bg: "transparent", color: ts.fg, borderColor: tsMix(ts.fg, 24)},
} as const;

const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minH: "44px",
    px: "22px",
    borderRadius: "999px",
    borderWidth: "1px",
    borderStyle: "solid",
    font: "inherit",
    fontWeight: 600,
    fontSize: "15px",
    whiteSpace: "nowrap",
    textDecoration: "none",
    cursor: "pointer",
    _hover: {opacity: 0.88},
    _focusVisible: {outline: `2px solid ${ts.fg}`, outlineOffset: "2px"},
    _disabled: {opacity: 0.5, cursor: "not-allowed"},
} as const;

type ButtonProps = HTMLChakraProps<"button"> & { variant?: TsButtonVariant };
type LinkProps = HTMLChakraProps<"a"> & { variant?: TsButtonVariant; href: string };

/** Pill button in the kit's colours: primary (main action), secondary (claims, Earn) or ghost. */
export function TsButton({variant = "primary", ...props}: ButtonProps) {
    return <chakra.button type="button" {...base} {...VARIANTS[variant]} {...props}/>;
}

/** A link that looks like a `TsButton` (in-page anchors such as "Stake T"). */
export function TsLinkButton({variant = "primary", ...props}: LinkProps) {
    return <chakra.a {...base} {...VARIANTS[variant]} {...props}/>;
}
