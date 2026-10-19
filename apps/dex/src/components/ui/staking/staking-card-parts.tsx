import {Box, type BoxProps, chakra, Flex, SimpleGrid} from "@chakra-ui/react";
import {LuArrowUpRight} from "react-icons/lu";
import type {KeyboardEvent, ReactNode} from "react";

// The pieces of the /staking cards: the edge that tells the user's state, the token tile, the
// tags, the APR box, "Stake to earn" and the small stat tiles. Numbers stay neutral; the DEX
// colour marks the user's own stake, amber an unlock.

export type StakingCardState = 'staked' | 'unlocking' | 'default';

interface StakingCardProps extends Omit<BoxProps, 'onClick'> {
    state: StakingCardState;
    /** Names the card for screen readers when the whole card is a button. */
    label?: string;
    onClick?: () => void;
    children: ReactNode;
}

/** Staked = the DEX gradient edge, unlocking = an amber edge, otherwise the hairline. */
export const StakingCard = ({state, label, onClick, children, ...rest}: StakingCardProps) => {
    const onKeyDown = (e: KeyboardEvent) => {
        if (!onClick || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        onClick();
    };

    return (
        <Box
            p="1px"
            borderRadius="20px"
            {...(state === 'staked'
                ? {bgImage: 'featuredEdge', boxShadow: 'hg.featured'}
                : state === 'unlocking'
                    ? {bgGradient: 'to-br', gradientFrom: 'hg.warning/60', gradientVia: 'hg.warning/10', gradientTo: 'hg.hairline'}
                    : {bg: 'hg.hairline'})}
            {...(onClick ? {
                role: 'button',
                tabIndex: 0,
                'aria-label': label,
                cursor: 'pointer',
                onClick,
                onKeyDown,
                _focusVisible: {outline: '2px solid', outlineColor: 'app.focusRing', outlineOffset: '2px'},
                css: {'&:hover > div': {bg: 'var(--chakra-colors-hg-raised)'}},
            } : {})}
            data-testid="staking-card"
            data-state={state}
            {...rest}
        >
            <Flex
                direction="column"
                gap="14px"
                bg="hg.card"
                borderRadius="19px"
                px={{base: '16px', md: '22px'}}
                py="20px"
                transitionProperty="background"
                transitionDuration="moderate"
            >
                {children}
            </Flex>
        </Box>
    );
};

/** A token's logo on a 48 px inset tile. */
export const TokenTile = ({children}: { children: ReactNode }) => (
    <Flex boxSize="48px" flex="none" align="center" justify="center" borderRadius="14px" bg="hg.inset">
        {children}
    </Flex>
);

/** The small mono tag naming the reward kind: "Simple reward" / "Compounded reward". */
export const KindTag = ({children}: { children: ReactNode }) => (
    <chakra.span fontFamily="mono" fontSize="11px" px="7px" py="2px" borderRadius="6px" color="hg.text.muted" bg="hg.inset">
        {children}
    </chakra.span>
);

/** The DEX-tinted "Verified" pill. */
export const VerifiedPill = () => (
    <chakra.span fontSize="11px" fontWeight="600" px="8px" py="2px" borderRadius="full" color="hg.link" bg="app.subtle" borderWidth="1px" borderColor="app.border">
        Verified
    </chakra.span>
);

/** The card's title, its tags and the APR on the right. */
export const StakingCardHeader = ({tile, title, tags, apr}: { tile: ReactNode; title: ReactNode; tags?: ReactNode; apr?: string }) => (
    <Flex justify="space-between" align="center" gap="16px" wrap="wrap">
        <Flex align="center" gap="14px" minW="0">
            <TokenTile>{tile}</TokenTile>
            <Flex direction="column" gap="6px" minW="0">
                <chakra.strong fontSize="18px" lineHeight="1.2">{title}</chakra.strong>
                {tags && <Flex gap="6px" wrap="wrap" align="center">{tags}</Flex>}
            </Flex>
        </Flex>
        {apr && <AprBox apr={apr}/>}
    </Flex>
);

/** The APR on a success-tinted box: "↗ APR ≈12.3%". */
export const AprBox = ({apr}: { apr: string }) => (
    <Flex
        direction="column"
        align={{base: 'center', md: 'flex-end'}}
        w={{base: 'full', md: 'auto'}}
        px="16px"
        py="10px"
        borderRadius="14px"
        bg="hg.success/8"
        borderWidth="1px"
        borderColor="hg.success/30"
        color="hg.success.text"
        data-testid="staking-apr"
    >
        <chakra.span display="inline-flex" alignItems="center" gap="2px" fontSize="11px" fontWeight="700" letterSpacing="0.08em">
            <LuArrowUpRight size={12} aria-hidden="true"/>APR
        </chakra.span>
        <chakra.strong fontSize="22px" lineHeight="1.2">{apr}</chakra.strong>
    </Flex>
);

/** "Stake to earn": what goes in and what comes out. */
export const StakeToEarn = ({stakeTile, stakeTicker, earnTile, earnTicker}: {
    stakeTile: ReactNode;
    stakeTicker?: string;
    earnTile: ReactNode;
    earnTicker?: string;
}) => (
    <Flex direction="column" align="center" gap="8px" bg="hg.inset" borderRadius="14px" p="14px">
        <chakra.span fontSize="11px" fontWeight="700" letterSpacing="0.12em" color="hg.text.faint">STAKE TO EARN</chakra.span>
        <Flex align="center" gap="18px" fontSize="14px">
            <Flex direction="column" align="center" gap="4px">
                {stakeTile}
                <chakra.span fontSize="11px" color="hg.text.faint">Stake</chakra.span>
                <strong>{stakeTicker}</strong>
            </Flex>
            <chakra.span color="hg.text.faint" aria-hidden="true">→</chakra.span>
            <Flex direction="column" align="center" gap="4px">
                {earnTile}
                <chakra.span fontSize="11px" color="hg.text.faint">Earn</chakra.span>
                <strong>{earnTicker}</strong>
            </Flex>
        </Flex>
    </Flex>
);

/** A small neutral stat tile: UNLOCK, DAILY, MINIMUM, TOTAL. */
export const MiniStat = ({label, children, sub}: { label: string; children: ReactNode; sub?: ReactNode }) => (
    <Flex direction="column" gap="2px" bg="hg.inset" borderRadius="12px" px="12px" py="10px" minW="0">
        <chakra.span fontSize="10px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color="hg.text.faint">{label}</chakra.span>
        <Box fontSize="14px" fontWeight="700" minW="0" overflowWrap="anywhere">{children}</Box>
        {sub && <chakra.span fontSize="11px" color="hg.success.text">{sub}</chakra.span>}
    </Flex>
);

export const MiniStats = ({children}: { children: ReactNode }) => (
    <SimpleGrid columns={{base: 2, md: 4}} gap="10px">{children}</SimpleGrid>
);

/** A program's progress: "[x] OF [y] DAYS REMAINING" and the DEX-gradient bar. */
export const ProgramProgress = ({remaining, duration, percent}: { remaining: number; duration?: number; percent: number }) => (
    <Flex direction="column" gap="8px">
        <Flex justify="space-between" fontSize="11px" fontWeight="700" letterSpacing="0.08em" color="hg.text.faint">
            <span>{remaining} OF {duration} DAYS REMAINING</span>
            <span>{percent.toFixed(0)}%</span>
        </Flex>
        <Box
            h="6px"
            borderRadius="3px"
            bg="hg.inset"
            overflow="hidden"
            role="progressbar"
            aria-label="Program progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(percent)}
        >
            <Box h="100%" w={`${Math.min(100, Math.max(0, percent))}%`} bgImage="app"/>
        </Box>
    </Flex>
);

/** A section of /staking: its title and line, and an action or link on the right. */
export const StakingSection = ({title, description, icon, aside, children}: {
    title: string;
    description: ReactNode;
    icon?: ReactNode;
    aside?: ReactNode;
    children: ReactNode;
}) => (
    <chakra.section display="flex" flexDirection="column" gap="16px" mt="12px" aria-label={title}>
        <Flex justify="space-between" align="flex-end" gap="16px" wrap="wrap">
            <Flex gap="12px" align="flex-start">
                {icon && (
                    <Flex boxSize="40px" flex="none" align="center" justify="center" borderRadius="12px" bg="app.subtle" borderWidth="1px" borderColor="app.border" color="hg.accent">
                        {icon}
                    </Flex>
                )}
                <Flex direction="column" gap="4px">
                    <chakra.h2 m="0" fontSize="22px" fontWeight="700">{title}</chakra.h2>
                    <chakra.span fontSize="14px" color="fg.muted">{description}</chakra.span>
                </Flex>
            </Flex>
            {aside}
        </Flex>
        {children}
    </chakra.section>
);
