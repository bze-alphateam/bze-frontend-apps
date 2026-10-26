'use client';

import React from "react";
import {chakra, type HTMLChakraProps} from "@chakra-ui/react";

import {ts, tsMix} from "./tokens";

export type TsButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS = {
    // The kit's gradient with a soft glow of the primary.
    primary: {bg: ts.gradient, color: ts.onPri, borderColor: "transparent", fontWeight: 700, boxShadow: `0 10px 28px -12px ${ts.pri}`},
    // A tint of the secondary ("Buy tickets", Earn's "Stake T").
    secondary: {bg: tsMix(ts.sec, 16), color: ts.fg, borderColor: tsMix(ts.sec, 45)},
    ghost: {bg: tsMix(ts.fg, 4, "transparent"), color: ts.fg, borderColor: tsMix(ts.fg, 22)},
    // Never filled, so it stays distinct from a red brand's primary.
    danger: {bg: tsMix(ts.danger, 10), color: ts.danger, borderColor: ts.danger},
} as const;

const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    minH: "44px",
    px: "22px",
    borderRadius: "14px",
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

/** Button in the kit's colours: primary (the gradient, main action), secondary (a tint of the secondary), ghost, or danger (confirming an unstake). */
export function TsButton({variant = "primary", ...props}: ButtonProps) {
    return <chakra.button type="button" data-variant={variant} {...base} {...VARIANTS[variant]} {...props}/>;
}

/** A link that looks like a `TsButton` (in-page anchors such as "Stake T"). */
export function TsLinkButton({variant = "primary", ...props}: LinkProps) {
    return <chakra.a data-variant={variant} {...base} {...VARIANTS[variant]} {...props}/>;
}
