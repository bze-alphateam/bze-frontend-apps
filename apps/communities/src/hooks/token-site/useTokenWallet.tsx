'use client';

import React, {createContext, useCallback, useContext, useMemo, useState} from "react";
import {useChain} from "@interchain-kit/react";
import {WalletState} from "@interchain-kit/core";
import {getChainName} from "@bze/bze-ui-kit";

/** The wallet drawer's action tabs. Burn arrives with BFE-131. */
export type WalletTab = "get" | "send" | "burn";

/** What the drawer shows: the wallet itself or the settings panel (BFE-128). */
export type WalletView = "wallet" | "settings";

interface TokenWalletValue {
    isOpen: boolean;
    /** The tab asked for; the drawer shows the first available one when this one isn't. */
    tab: WalletTab;
    view: WalletView;
    /** Opens the drawer on the wallet view, on `tab`. */
    open: (tab?: WalletTab) => void;
    /** Opens the drawer on the settings panel. */
    openSettings: () => void;
    close: () => void;
    setTab: (tab: WalletTab) => void;
    setView: (view: WalletView) => void;
    /**
     * Opens the interchain-kit connect modal. The drawer would cover it, so the drawer closes
     * first and opens again once the wallet is connected.
     */
    connect: () => void;
}

const TokenWalletContext = createContext<TokenWalletValue | null>(null);

/** Holds the token site's wallet drawer state; rendered by `TokenSite`. */
export function TokenWalletProvider({children}: { children: React.ReactNode }) {
    const {status, connect: openConnectModal} = useChain(getChainName());
    const [isOpen, setIsOpen] = useState(false);
    const [tab, setTab] = useState<WalletTab>("get");
    const [view, setView] = useState<WalletView>("wallet");
    const [reopenOnConnect, setReopenOnConnect] = useState(false);

    const open = useCallback((next: WalletTab = "get") => {
        setTab(next);
        setView("wallet");
        setIsOpen(true);
    }, []);
    const openSettings = useCallback(() => {
        setView("settings");
        setIsOpen(true);
    }, []);
    const close = useCallback(() => setIsOpen(false), []);
    const connect = useCallback(() => {
        setIsOpen(false);
        setReopenOnConnect(true);
        openConnectModal();
    }, [openConnectModal]);

    // Reopen once the connect modal has done its job (state adjusted during render, not in an effect).
    const [seenStatus, setSeenStatus] = useState(status);
    if (status !== seenStatus) {
        setSeenStatus(status);
        if (reopenOnConnect && status === WalletState.Connected) {
            setReopenOnConnect(false);
            setView("wallet");
            setIsOpen(true);
        }
    }

    const value = useMemo(
        () => ({isOpen, tab, view, open, openSettings, close, setTab, setView, connect}),
        [isOpen, tab, view, open, openSettings, close, connect],
    );

    return <TokenWalletContext.Provider value={value}>{children}</TokenWalletContext.Provider>;
}

/** The token site's wallet drawer: header button, "Get T" buttons and the drawer itself. */
export function useTokenWallet(): TokenWalletValue {
    const value = useContext(TokenWalletContext);
    if (!value) {
        throw new Error("useTokenWallet must be used inside a TokenWalletProvider");
    }

    return value;
}
