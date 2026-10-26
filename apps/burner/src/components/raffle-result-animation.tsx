'use client';

import {Box, chakra, Flex, IconButton} from "@chakra-ui/react";
import {useEffect, useState, type CSSProperties, type ReactNode} from "react";
import {LuFlame, LuHeart, LuListChecks, LuTrophy, LuX} from "react-icons/lu";
import {usePrefersReducedMotion} from "@/hooks/usePrefersReducedMotion";

interface RaffleResultAnimationProps {
    result: 'win' | 'lose' | 'waiting' | 'summary';
    ticker: string;
    amount?: string;
    currentContribution?: number;
    totalContributions?: number;
    onComplete?: () => void;
    onNextContribution?: () => void;
    // Summary data
    totalWon?: string;
    winnersCount?: number;
    losersCount?: number;
    contributionPrice?: string;
}

/** The lines shown, one after another, while the chain decides a contribution. */
const WAITING_MESSAGES = [
    (ticker: string) => `Melting ${ticker} coins in the pot...`,
    () => `The pot is hot, coins are melting!`,
    () => `Flames are dancing, luck is brewing...`,
    () => `The fire god is deciding your fate...`,
    () => `Coins swirling in the flames...`,
    () => `The burning ceremony begins...`,
    () => `Checking if fortune favors you...`,
    () => `The cosmic dice are rolling...`,
    () => `Destiny is being forged in fire...`,
    () => `Your fate is written in the flames...`,
    () => `The heat is rising, luck is cooking...`,
    () => `Fire spirits whisper your fortune...`,
    () => `Ashes to ashes, tokens to tokens...`,
    () => `The inferno decides who wins...`,
    () => `Lady Luck is watching the flames...`,
    () => `Your tokens are dancing in the fire...`,
    () => `The phoenix of fortune is stirring...`,
    () => `Burning bright, hoping for gold...`,
    () => `The flames hold all the answers...`,
    () => `Fortune cookies are burning nicely...`,
    () => `The lottery of fire is in motion...`,
    () => `Sparks fly, winners emerge...`,
    () => `The embers glow with possibility...`,
    () => `Your contribution fuels the fire...`,
    () => `The universe is calculating odds...`,
    () => `Smoke signals reveal your fate...`,
    () => `The furnace of fortune is hot...`,
    () => `Probability waves through the flames...`,
    () => `The wheel of fire is spinning...`,
    () => `Luck is simmering in the cauldron...`,
];

const SPARK_COUNT = 24;

type Tone = 'ember' | 'success' | 'quiet';

/** The 64 px state icon: ember gradient while waiting and on the summary, green on a win, an inset tile on a loss. */
const StateIcon = ({tone, children}: { tone: Tone; children: ReactNode }) => (
    <Flex
        as="span"
        aria-hidden
        boxSize="64px"
        align="center"
        justify="center"
        borderRadius="20px"
        css={{'& svg': {width: '28px', height: '28px'}}}
        {...(tone === 'ember'
            ? {bgImage: 'app', color: 'hg.buttonText', boxShadow: 'hg.featured'}
            : tone === 'success'
                ? {bg: 'hg.success', color: 'hg.ground'}
                : {bg: 'hg.inset', color: 'hg.link', borderWidth: '1px', borderColor: 'hg.hairline'})}
    >
        {children}
    </Flex>
);

/** One Won / Lost count of the summary. */
const ResultCount = ({value, label, success}: { value: number; label: string; success?: boolean }) => (
    <Flex
        direction="column"
        gap="2px"
        minW="96px"
        px="14px"
        py="10px"
        borderRadius="14px"
        borderWidth="1px"
        {...(success
            ? {bg: 'hg.success/10', borderColor: 'hg.success/30'}
            : {bg: 'hg.secondaryFill', borderColor: 'hg.lineStrong'})}
    >
        <chakra.strong fontSize="20px" color={success ? 'hg.success.text' : 'hg.text.secondary'}>{value}</chakra.strong>
        <chakra.span fontSize="12px" color="hg.text.secondary">{label}</chakra.span>
    </Flex>
);

/**
 * The full-screen overlay on the coin page after joining a raffle: waiting, then a win or a loss
 * for each contribution, then the summary. Embers rise from the bottom unless the user prefers
 * reduced motion, which also stills every other animation.
 */
export const RaffleResultAnimation = ({
    result,
    ticker,
    amount,
    currentContribution = 1,
    totalContributions = 1,
    onComplete,
    onNextContribution,
    totalWon,
    winnersCount = 0,
    losersCount = 0,
    contributionPrice,
}: RaffleResultAnimationProps) => {
    const reducedMotion = usePrefersReducedMotion();
    const [showResult, setShowResult] = useState(false);
    const [currentMessage, setCurrentMessage] = useState(() => Math.floor(Math.random() * WAITING_MESSAGES.length));
    const [sparks] = useState(() => Array.from({length: SPARK_COUNT}, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 3 + Math.random() * 5,
        delay: Math.random() * 3,
        duration: 2.5 + Math.random() * 2.5,
        drift: (Math.random() - 0.5) * 80,
    })));

    useEffect(() => {
        // While waiting, rotate through the lines
        if (result === 'waiting') {
            const messageInterval = setInterval(() => {
                setCurrentMessage((prev) => (prev + 1) % WAITING_MESSAGES.length);
            }, 2500);

            return () => clearInterval(messageInterval);
        }

        // The summary shows at once and stays until the user closes it
        if (result === 'summary') return;

        const resultTimer = setTimeout(() => {
            setShowResult(true);
        }, 500);

        // After showing a result, always move on and let the parent decide what comes next
        // (another result, waiting, or the summary)
        const nextActionTimer = setTimeout(() => {
            onNextContribution?.();
        }, 3000);

        return () => {
            clearTimeout(resultTimer);
            clearTimeout(nextActionTimer);
        };
    }, [result, currentContribution, totalContributions, onComplete, onNextContribution]);

    const animate = (value: string) => (reducedMotion ? undefined : value);
    const glow = result === 'win' ? 'hg.success/30' : result === 'lose' ? 'app.subtle' : 'app.muted';

    return (
        <Box
            // The overlay is dark in both colour modes.
            className="dark"
            role="dialog"
            aria-modal="true"
            aria-label="Raffle result"
            position="fixed"
            inset="0"
            bg="hg.ground/90"
            color="fg"
            zIndex={9999}
            display="flex"
            alignItems="center"
            justifyContent="center"
            animation={animate("hgRaffleFadeIn 0.3s ease-out")}
            data-testid="raffle-result"
            data-motion={reducedMotion ? 'reduced' : 'full'}
        >
            <Box aria-hidden position="absolute" insetX="0" bottom="0" h="70%" pointerEvents="none"
                 bgGradient="to-t" gradientFrom={glow} gradientTo="transparent"/>

            {!reducedMotion && (
                <Box aria-hidden position="absolute" inset="0" overflow="hidden" pointerEvents="none">
                    {sparks.map((spark) => (
                        <Box
                            key={spark.id}
                            data-testid="raffle-spark"
                            position="absolute"
                            bottom="-12px"
                            left={`${spark.left}%`}
                            boxSize={`${spark.size}px`}
                            borderRadius="full"
                            bgImage="app"
                            boxShadow="hg.featured"
                            animation={`hgEmberRise ${spark.duration}s ease-in ${spark.delay}s infinite`}
                            style={{'--drift': `${spark.drift}px`} as CSSProperties}
                        />
                    ))}
                </Box>
            )}

            {totalContributions > 1 && (
                <chakra.span
                    position="absolute"
                    top="14px"
                    left="50%"
                    transform="translateX(-50%)"
                    fontSize="13px"
                    fontWeight="600"
                    px="12px"
                    py="6px"
                    borderRadius="hg.pill"
                    bg="hg.secondaryFill"
                    borderWidth="1px"
                    borderColor="hg.lineStrong"
                    whiteSpace="nowrap"
                >
                    {result === 'summary' ? 'Summary' : `Contribution ${currentContribution} of ${totalContributions}`}
                </chakra.span>
            )}

            <IconButton
                position="absolute"
                top="10px"
                right="10px"
                aria-label="Close"
                size="lg"
                variant="ghost"
                color="hg.text.secondary"
                _hover={{bg: 'hg.hoverFill', color: 'fg'}}
                onClick={onComplete}
            >
                <LuX/>
            </IconButton>

            {result === 'waiting' && (
                <Flex direction="column" align="center" gap="16px" position="relative" px="24px" textAlign="center">
                    <StateIcon tone="ember"><LuFlame/></StateIcon>
                    <chakra.strong
                        key={currentMessage}
                        fontSize={{base: '22px', md: '26px'}}
                        fontWeight="800"
                        letterSpacing="-0.01em"
                        aria-live="polite"
                        animation={animate("hgRaffleRise 0.5s ease-out")}
                    >
                        {WAITING_MESSAGES[currentMessage](ticker)}
                    </chakra.strong>
                </Flex>
            )}

            {result !== 'waiting' && (showResult || result === 'summary') && (
                <Flex
                    direction="column"
                    align="center"
                    gap="12px"
                    position="relative"
                    px="24px"
                    maxW="90%"
                    textAlign="center"
                    aria-live="polite"
                    animation={animate("hgRaffleRise 0.5s ease-out")}
                >
                    {result === 'win' ? (
                        <>
                            <StateIcon tone="success"><LuTrophy/></StateIcon>
                            <chakra.strong fontSize={{base: '34px', md: '40px'}} fontWeight="800" letterSpacing="-0.01em">YOU WON!</chakra.strong>
                            {amount && (
                                <>
                                    <chakra.span fontSize={{base: '28px', md: '34px'}} fontWeight="800" color="hg.success">+{amount} {ticker}</chakra.span>
                                    <chakra.span fontSize="15px" color="hg.text.secondary">Congratulations!</chakra.span>
                                </>
                            )}
                        </>
                    ) : result === 'summary' ? (
                        <>
                            <StateIcon tone="ember"><LuListChecks/></StateIcon>
                            <chakra.strong fontSize={{base: '22px', md: '24px'}} fontWeight="800" letterSpacing="-0.01em">
                                {`Your ${totalContributions} ${totalContributions === 1 ? 'contribution is' : 'contributions are'} complete`}
                            </chakra.strong>
                            {contributionPrice && (
                                <chakra.span fontSize="15px" color="hg.text.secondary">
                                    Total paid: {(parseFloat(contributionPrice) * totalContributions).toFixed(2)} {ticker}
                                </chakra.span>
                            )}
                            {winnersCount > 0 && totalWon && (
                                <Flex direction="column" align="center" gap="2px">
                                    <chakra.span fontSize="15px" color="hg.text.secondary">Total Won</chakra.span>
                                    <chakra.span fontSize={{base: '28px', md: '34px'}} fontWeight="800" color="hg.success">+{totalWon} {ticker}</chakra.span>
                                </Flex>
                            )}
                            {totalContributions > 1 && (
                                <Flex gap="12px" mt="4px">
                                    <ResultCount value={winnersCount} label="Won" success/>
                                    <ResultCount value={losersCount} label="Lost"/>
                                </Flex>
                            )}
                            {winnersCount === 0 && (
                                <chakra.span fontSize="15px" color="hg.text.secondary">Better luck next time!</chakra.span>
                            )}
                        </>
                    ) : (
                        <>
                            <StateIcon tone="quiet"><LuHeart/></StateIcon>
                            <chakra.strong fontSize={{base: '22px', md: '24px'}} fontWeight="800" letterSpacing="-0.01em">Thank you for your contribution!</chakra.strong>
                            <chakra.span fontSize="15px" color="hg.text.secondary">You were not lucky this time</chakra.span>
                            <chakra.span fontSize="15px" color="hg.text.secondary">Maybe next time!</chakra.span>
                        </>
                    )}
                </Flex>
            )}

            {!reducedMotion && (
                <style jsx global>{`
                    @keyframes hgRaffleFadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }

                    @keyframes hgRaffleRise {
                        from { opacity: 0; transform: translateY(16px); }
                        to { opacity: 1; transform: translateY(0); }
                    }

                    @keyframes hgEmberRise {
                        0% { transform: translate(0, 0) scale(1); opacity: 0; }
                        10% { opacity: 1; }
                        100% { transform: translate(var(--drift), -85vh) scale(0.3); opacity: 0; }
                    }
                `}</style>
            )}
        </Box>
    );
};
