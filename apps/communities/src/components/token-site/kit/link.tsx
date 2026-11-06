'use client';

import React from "react";
import NextLink from "next/link";
import {chakra, type HTMLChakraProps} from "@chakra-ui/react";

type TsLinkProps = HTMLChakraProps<"a"> & { href: string };

/** An app page of our own: a root-relative path, not a protocol-relative URL. */
const isAppPath = (href: string) => href.startsWith("/") && !href.startsWith("//");

/**
 * The kit's anchor. Links to the app's own pages go through `next/link`, so moving between the
 * token page and its inner pages keeps the app (assets, wallet, theme) loaded instead of reloading
 * the document; in-page anchors, external links and new-tab links stay plain anchors.
 */
export function TsLink({href, target, children, ...props}: TsLinkProps) {
    if (!isAppPath(href) || target) {
        return <chakra.a href={href} target={target} {...props}>{children}</chakra.a>;
    }

    return (
        <chakra.a asChild {...props}>
            <NextLink href={href}>{children}</NextLink>
        </chakra.a>
    );
}
