'use client'

// The dapps' wallet-pick modal. It follows interchain-kit's InterchainWalletModal (same views,
// same interchain-ui components) and adds the wallets that are listed but not connectable yet:
// they show greyed out with a "Coming soon" badge under the connectable ones.

import {useState} from 'react';
import type {IconType} from 'react-icons';
import {Badge, chakra, Image, Text} from '@chakra-ui/react';
import {WalletState} from '@interchain-kit/core';
import {useWalletManager} from '@interchain-kit/react';
import {
    ConnectModal,
    ConnectModalHead,
    ConnectModalQRCode,
    ConnectModalStatus,
    ConnectModalWalletList,
    ThemeProvider,
    type Wallet as WalletUI,
} from '@interchain-ui/react';
import {FaAndroid} from 'react-icons/fa';
import {GoDesktopDownload} from 'react-icons/go';
import {GrFirefox} from 'react-icons/gr';
import {LuCircleUserRound} from 'react-icons/lu';
import {RiAppStoreFill, RiChromeFill} from 'react-icons/ri';
import {hgVariant} from '../theme/variants';
import type {ComingSoonWallet} from '../utils/wallet_availability';

export interface WalletPickModalProps {
    /** Wallets listed in the picker but not connectable (see `splitComingSoonWallets`). */
    comingSoonWallets?: ComingSoonWallet[];
}

type StatefulWallet = ReturnType<typeof useWalletManager>['wallets'][number];
type View = 'list' | 'qr' | 'notExist' | 'rejected' | 'error' | 'connected' | 'connecting';

const logoUrl = (logo: StatefulWallet['info']['logo']): string =>
    typeof logo === 'string' ? logo : (logo?.major ?? '');

// WalletConnect peer metadata, present once a mobile wallet is paired.
interface WalletConnectSession {
    peer?: {metadata?: {name?: string; icons?: string[]}};
}

const toWalletUI = (wallet: StatefulWallet): WalletUI => {
    const session = wallet.info.mode === 'wallet-connect'
        ? (wallet as unknown as {session?: WalletConnectSession}).session
        : undefined;
    // A paired WalletConnect wallet shows as its mobile peer, as in interchain-kit. The wallet
    // itself stays the original: interchain-kit passes a spread copy, which loses the store's
    // connect method.
    if (session) {
        const peerName = session.peer?.metadata?.name ?? '';
        return {
            name: peerName,
            prettyName: `${peerName} - Mobile`,
            logo: session.peer?.metadata?.icons?.[0] ?? '',
            subLogo: logoUrl(wallet.info.logo),
            mobileDisabled: true,
            shape: 'list',
            originalWallet: wallet,
        };
    }

    return {
        name: wallet.info.name,
        prettyName: wallet.info.prettyName,
        logo: logoUrl(wallet.info.logo),
        mobileDisabled: true,
        shape: 'list',
        originalWallet: wallet,
    };
};

const statusWallet = (wallet: StatefulWallet): WalletUI => ({
    name: wallet.info.name,
    prettyName: wallet.info.prettyName,
    logo: logoUrl(wallet.info.logo),
    mobileDisabled: true,
});

const installIcon = (env: {browser?: string; os?: string}): IconType => {
    if (env.browser === 'chrome') return RiChromeFill;
    if (env.browser === 'firefox') return GrFirefox;
    if (env.os === 'android') return FaAndroid;
    if (env.os === 'ios') return RiAppStoreFill;
    return GoDesktopDownload;
};

const viewFor = (wallet: StatefulWallet | undefined, showList: boolean, qrCodeUri: string | null | undefined): View => {
    if (showList || !wallet) return 'list';
    const state = wallet.walletState;
    if (state === WalletState.Disconnected && wallet.errorMessage === '') return 'list';
    if (qrCodeUri && wallet.info.name === 'WalletConnect') return 'qr';
    if (state === WalletState.NotExist) return 'notExist';
    if (state === WalletState.Rejected) return 'rejected';
    if (wallet.errorMessage) return 'error';
    if (state === WalletState.Connected) return 'connected';
    if (state === WalletState.Connecting) return 'connecting';
    return 'list';
};

// Sizes follow interchain-ui's list items: 52px tall, 0.5rem padding, 2rem logo, 1rem gap.
const ComingSoonRows = ({wallets}: {wallets: ComingSoonWallet[]}) => (
    <chakra.div display="grid" rowGap="0.25rem" px="0.125rem" pb="1rem">
        {wallets.map((wallet) => (
            // A native disabled button: skipped by the tab order, announced as unavailable.
            <chakra.button
                key={wallet.name}
                type="button"
                disabled
                display="flex"
                alignItems="center"
                gap="1rem"
                w="full"
                h="52px"
                p="0.5rem"
                borderRadius="lg"
                bg="transparent"
                color="inherit"
                cursor="not-allowed"
                textAlign="left"
            >
                {/* Only the wallet itself is dimmed; the badge stays readable. */}
                {wallet.logo && <Image src={wallet.logo} alt="" boxSize="2rem" objectFit="contain" opacity={0.5}/>}
                <Text as="span" flex="1" fontWeight="600" fontSize="sm" opacity={0.5}>{wallet.prettyName}</Text>
                <Badge size="sm" variant={hgVariant('neutral')} borderRadius="hg.pill">Coming soon</Badge>
            </chakra.button>
        ))}
    </chakra.div>
);

export const WalletPickModal = ({comingSoonWallets = []}: WalletPickModalProps) => {
    const [shouldShowList, setShouldShowList] = useState(false);
    const [walletToConnect, setWalletToConnect] = useState<StatefulWallet | null>(null);
    const {
        modalIsOpen,
        walletConnectQRCodeUri,
        wallets,
        getChainWalletState,
        currentWalletName,
        currentChainName,
        openModal,
        closeModal,
        chains,
        getDownloadLink,
        getEnv,
    } = useWalletManager();

    const chainNameToConnect = currentChainName || chains[0]?.chainName;
    const chainToConnect = chains.find((chain) => chain.chainName === chainNameToConnect);
    const currentWallet = wallets.find((wallet) => wallet.info.name === currentWalletName);
    const walletToShow = walletToConnect ?? currentWallet;
    const {account, errorMessage} = getChainWalletState(walletToConnect?.info?.name || currentWalletName, currentChainName) ?? {};

    const onSelectWallet = (wallet: StatefulWallet) => {
        setWalletToConnect(wallet);
        setShouldShowList(false);
        if (chainToConnect) return wallet.connect(chainToConnect.chainId);
    };
    const onBack = () => setShouldShowList(true);
    const close = () => {
        closeModal();
        setShouldShowList(false);
    };
    const onReconnect = () => {
        if (walletToShow) onSelectWallet(walletToShow);
    };

    const view = viewFor(walletToShow, shouldShowList, walletConnectQRCodeUri);
    const title = walletToShow?.info?.prettyName ?? '';

    let header;
    let content;
    if (view === 'list' || !walletToShow) {
        header = <ConnectModalHead title="Select your wallet" hasBackButton={false} onClose={close} closeButtonProps={{onClick: close}}/>;
        content = (
            <>
                <ConnectModalWalletList wallets={wallets.map(toWalletUI)} onWalletItemClick={onSelectWallet}/>
                {comingSoonWallets.length > 0 && <ComingSoonRows wallets={comingSoonWallets}/>}
            </>
        );
    } else {
        header = (
            <ConnectModalHead
                title={title}
                hasBackButton
                onClose={view === 'qr' ? () => undefined : close}
                onBack={onBack}
                closeButtonProps={{onClick: close}}
            />
        );
        switch (view) {
            case 'qr':
                content = (
                    <ConnectModalQRCode
                        status={walletConnectQRCodeUri ? 'Done' : 'Pending'}
                        link={walletConnectQRCodeUri ?? ''}
                        description="Open App to connect"
                        errorTitle="errorTitle"
                        errorDesc={errorMessage || ''}
                        onRefresh={onReconnect}
                    />
                );
                break;
            case 'notExist': {
                const downloadLink = getDownloadLink(walletToShow.info.name);
                const InstallIcon = installIcon(getEnv());
                content = (
                    <ConnectModalStatus
                        status="NotExist"
                        wallet={{name: title, logo: logoUrl(walletToShow.info.logo), mobileDisabled: true}}
                        contentHeader={`${title} Not Installed`}
                        contentDesc={`If ${title.toLowerCase()} is installed on your device, please refresh this page or follow the browser instruction.`}
                        onInstall={() => {
                            if (downloadLink) window.open(downloadLink.link, '_blank');
                        }}
                        installIcon={<InstallIcon/>}
                        disableInstall={downloadLink === null}
                    />
                );
                break;
            }
            case 'rejected':
                content = (
                    <ConnectModalStatus
                        status="Rejected"
                        wallet={statusWallet(walletToShow)}
                        contentHeader="Request Rejected"
                        contentDesc={walletToShow.errorMessage || 'Connection permission is denied.'}
                        onConnect={onReconnect}
                    />
                );
                break;
            case 'error':
                content = (
                    <ConnectModalStatus
                        status="Error"
                        wallet={statusWallet(walletToShow)}
                        contentHeader="Oops! Something wrong..."
                        contentDesc={walletToShow.errorMessage}
                        onChangeWallet={onBack}
                    />
                );
                break;
            case 'connected':
                content = (
                    <ConnectModalStatus
                        status="Connected"
                        wallet={statusWallet(walletToShow)}
                        connectedInfo={{
                            name: account?.username || 'Wallet',
                            avatar: <LuCircleUserRound style={{width: '100%', height: '100%'}}/>,
                            address: account?.address ?? '',
                        }}
                        onDisconnect={() => {
                            if (chainToConnect) walletToShow.disconnect(chainToConnect.chainId);
                        }}
                    />
                );
                break;
            case 'connecting':
                content = (
                    <ConnectModalStatus
                        status="Connecting"
                        wallet={statusWallet(walletToShow)}
                        contentHeader="Requesting Connection"
                        contentDesc={walletToShow.info.mode === 'wallet-connect'
                            ? `Approve ${title} connection request on your mobile.`
                            : `Open the ${title} browser extension to connect your wallet.`}
                    />
                );
                break;
        }
    }

    return (
        <ThemeProvider>
            <ConnectModal isOpen={modalIsOpen} header={header} onOpen={openModal} onClose={close}>
                {content}
            </ConnectModal>
        </ThemeProvider>
    );
};
