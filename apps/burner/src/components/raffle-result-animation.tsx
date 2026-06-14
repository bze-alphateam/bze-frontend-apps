'use client';

import { Box, HStack, IconButton, Text, VStack } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { LuX } from "react-icons/lu";

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

const WAITING_MESSAGES = [
    (ticker: string) => `Melting ${ticker} coins in the pot... 🔥`,
    () => `The pot is hot, coins are melting! 🫠`,
    () => `Flames are dancing, luck is brewing... ✨`,
    () => `The fire god is deciding your fate... 🎲`,
    () => `Coins swirling in the flames... 🌀`,
    () => `The burning ceremony begins... 🕯️`,
    () => `Checking if fortune favors you... 🍀`,
    () => `The cosmic dice are rolling... 🎰`,
    () => `Destiny is being forged in fire... ⚡`,
    () => `Your fate is written in the flames... 📜`,
    () => `The heat is rising, luck is cooking... 🌡️`,
    () => `Fire spirits whisper your fortune... 👻`,
    () => `Ashes to ashes, tokens to tokens... 💨`,
    () => `The inferno decides who wins... 🌋`,
    () => `Lady Luck is watching the flames... 👀`,
    () => `Your tokens are dancing in the fire... 💃`,
    () => `The phoenix of fortune is stirring... 🦅`,
    () => `Burning bright, hoping for gold... ✨`,
    () => `The flames hold all the answers... 🔮`,
    () => `Fortune cookies are burning nicely... 🥠`,
    () => `The lottery of fire is in motion... 🎪`,
    () => `Sparks fly, winners emerge... 💫`,
    () => `The embers glow with possibility... 🌟`,
    () => `Your contribution fuels the fire... ⛽`,
    () => `The universe is calculating odds... 🌌`,
    () => `Smoke signals reveal your fate... 💭`,
    () => `The furnace of fortune is hot... 🏭`,
    () => `Probability waves through the flames... 🌊`,
    () => `The wheel of fire is spinning... 🎡`,
    () => `Luck is simmering in the cauldron... 🍲`,
];

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
    const [showResult, setShowResult] = useState(false);
    const [currentMessage, setCurrentMessage] = useState(() => Math.floor(Math.random() * WAITING_MESSAGES.length));
    const [coins] = useState(() => Array.from({ length: 20 }, (_, i) => ({
        id: i,
        delay: Math.random() * 0.5,
        startX: Math.random() * 100,
        duration: 1 + Math.random() * 0.5,
    })));

    useEffect(() => {
        // If we're waiting, cycle through messages
        if (result === 'waiting') {
            const messageInterval = setInterval(() => {
                setCurrentMessage((prev) => (prev + 1) % WAITING_MESSAGES.length);
            }, 2500);

            return () => clearInterval(messageInterval);
        }

        // If we're showing summary, just wait for user to close
        if (result === 'summary') {
            setShowResult(true);
            return;
        }

        const resultTimer = setTimeout(() => {
            setShowResult(true);
        }, 500);

        // After showing result, always move to next (which may trigger summary)
        const nextActionTimer = setTimeout(() => {
            // Always call onNextContribution to let parent decide what to show next
            // (could be another result, waiting, or summary)
            onNextContribution?.();
        }, 3000);

        return () => {
            clearTimeout(resultTimer);
            clearTimeout(nextActionTimer);
        };
    }, [result, currentContribution, totalContributions, onComplete, onNextContribution]);

    return (
        <Box
            position="fixed"
            top="0"
            left="0"
            right="0"
            bottom="0"
            bg="rgba(0, 0, 0, 0.9)"
            zIndex={9999}
            display="flex"
            alignItems="center"
            justifyContent="center"
            animation="fadeIn 0.3s ease-out"
        >
            {/* Contribution Counter */}
            {totalContributions > 1 && (
                <Box
                    position="absolute"
                    top="4"
                    left="4"
                    zIndex="10000"
                    bg="whiteAlpha.200"
                    backdropFilter="blur(10px)"
                    px="4"
                    py="2"
                    borderRadius="lg"
                    borderWidth="1px"
                    borderColor="whiteAlpha.300"
                >
                    <Text
                        fontSize="sm"
                        fontWeight="bold"
                        color="white"
                        textShadow="0 0 10px rgba(0, 0, 0, 0.5)"
                    >
                        {result === 'summary' ? 'Summary' : `Contribution ${currentContribution} of ${totalContributions}`}
                    </Text>
                </Box>
            )}

            {/* Close Button */}
            <IconButton
                position="absolute"
                top="4"
                right="4"
                zIndex="10000"
                aria-label="Close"
                size="lg"
                variant="ghost"
                colorPalette="gray"
                onClick={onComplete}
                _hover={{ bg: "whiteAlpha.200" }}
            >
                <LuX size={24} color="white" />
            </IconButton>
            {/* Flames */}
            <Box position="absolute" inset="0" overflow="hidden">
                {[...Array(8)].map((_, i) => (
                    <Box
                        key={`flame-${i}`}
                        position="absolute"
                        bottom="-50px"
                        left={`${i * 12.5}%`}
                        width="100px"
                        height="200px"
                        bgGradient="to-t"
                        gradientFrom="#ff4500"
                        gradientVia="#ffa500"
                        gradientTo="#ffff00"
                        borderRadius="50% 50% 0 0"
                        opacity="0.7"
                        animation={`flame 1s ease-in-out infinite ${i * 0.1}s`}
                        filter="blur(10px)"
                    />
                ))}
            </Box>

            {/* Falling Coins */}
            {coins.map((coin) => (
                <Box
                    key={`coin-${coin.id}`}
                    position="absolute"
                    top="-50px"
                    left={`${coin.startX}%`}
                    width="30px"
                    height="30px"
                    borderRadius="full"
                    bg="linear-gradient(135deg, #ffd700 0%, #ffed4e 50%, #ffd700 100%)"
                    border="2px solid"
                    borderColor="orange.400"
                    animation={`fall ${coin.duration}s linear ${coin.delay}s infinite`}
                    style={{
                        animationDelay: `${coin.delay}s`,
                    }}
                />
            ))}

            {/* Waiting State */}
            {result === 'waiting' && (
                <VStack
                    gap="6"
                    position="relative"
                    zIndex="1"
                    animation="fadeInOut 0.5s ease-in-out"
                >
                    <Text
                        fontSize={{ base: "2xl", md: "3xl" }}
                        fontWeight="bold"
                        color="orange.400"
                        textAlign="center"
                        textShadow="0 0 20px rgba(251, 146, 60, 0.8)"
                        animation="pulse 1.5s ease-in-out infinite"
                        px="4"
                        key={currentMessage}
                    >
                        {WAITING_MESSAGES[currentMessage](ticker)}
                    </Text>
                </VStack>
            )}

            {/* Explosion and Result */}
            {result !== 'waiting' && showResult && (
                <VStack
                    gap="6"
                    position="relative"
                    zIndex="1"
                    animation="explosionScale 0.5s ease-out"
                >
                    {/* Explosion particles - only for win */}
                    {result === 'win' && [...Array(12)].map((_, i) => (
                        <Box
                            key={`particle-${i}`}
                            position="absolute"
                            width="20px"
                            height="20px"
                            borderRadius="full"
                            bg="yellow.400"
                            animation={`explode-${i} 0.8s ease-out forwards`}
                            style={{
                                '--angle': `${i * 30}deg`,
                            } as React.CSSProperties}
                        />
                    ))}

                    {/* Result Text */}
                    <VStack gap="4" animation="resultFadeIn 0.5s ease-out 0.3s backwards" maxW="90%">
                        {result === 'win' ? (
                            <>
                                <Text
                                    fontSize={{ base: "5xl", md: "7xl" }}
                                    fontWeight="black"
                                    color="green.400"
                                    textShadow="0 0 20px rgba(34, 197, 94, 0.8), 0 0 40px rgba(34, 197, 94, 0.5)"
                                    animation="pulse 1s ease-in-out infinite"
                                    whiteSpace="nowrap"
                                >
                                    🎉 YOU WON! 🎉
                                </Text>
                                {amount && (
                                    <VStack gap="1">
                                        <Text
                                            fontSize={{ base: "3xl", md: "4xl" }}
                                            fontWeight="black"
                                            color="yellow.400"
                                            textShadow="0 0 20px rgba(251, 191, 36, 0.8)"
                                        >
                                            +{amount} {ticker}
                                        </Text>
                                        <Text fontSize="lg" color="gray.300">
                                            Congratulations! 🏆
                                        </Text>
                                    </VStack>
                                )}
                            </>
                        ) : result === 'summary' ? (
                            <>
                                <Text
                                    fontSize={{ base: "2xl", md: "3xl" }}
                                    fontWeight="black"
                                    color="purple.400"
                                    textAlign="center"
                                    textShadow="0 0 20px rgba(192, 132, 252, 0.8)"
                                    animation="pulse 1s ease-in-out infinite"
                                    px="4"
                                >
                                    🎊 Your {totalContributions} {totalContributions === 1 ? 'contribution' : 'contributions'} {totalContributions === 1 ? 'is' : 'are'} complete 🎊
                                </Text>
                                {contributionPrice && (
                                    <Text
                                        fontSize={{ base: "lg", md: "xl" }}
                                        fontWeight="semibold"
                                        color="purple.300"
                                        textAlign="center"
                                    >
                                        Total paid: {(parseFloat(contributionPrice) * totalContributions).toFixed(2)} {ticker}
                                    </Text>
                                )}
                                <VStack gap="4" mt="4">
                                    {winnersCount > 0 && totalWon && (
                                        <VStack gap="1">
                                            <Text fontSize="lg" color="gray.300" fontWeight="medium">
                                                Total Won
                                            </Text>
                                            <Text
                                                fontSize={{ base: "3xl", md: "4xl" }}
                                                fontWeight="black"
                                                color="green.400"
                                                textShadow="0 0 20px rgba(34, 197, 94, 0.8)"
                                            >
                                                +{totalWon} {ticker}
                                            </Text>
                                        </VStack>
                                    )}
                                    {totalContributions > 1 && (
                                        <VStack gap="2">
                                            <Text fontSize="md" color="gray.400" fontWeight="medium">
                                                Results
                                            </Text>
                                            <HStack gap="6">
                                                <VStack gap="0">
                                                    <Text fontSize="2xl" fontWeight="bold" color="green.400">
                                                        ✓ {winnersCount}
                                                    </Text>
                                                    <Text fontSize="sm" color="gray.400">
                                                        Won
                                                    </Text>
                                                </VStack>
                                                <VStack gap="0">
                                                    <Text fontSize="2xl" fontWeight="bold" color="gray.400">
                                                        ✗ {losersCount}
                                                    </Text>
                                                    <Text fontSize="sm" color="gray.400">
                                                        Lost
                                                    </Text>
                                                </VStack>
                                            </HStack>
                                        </VStack>
                                    )}
                                    {winnersCount === 0 && (
                                        <Text fontSize="md" color="gray.400" textAlign="center" mt="2">
                                            Better luck next time! 🍀
                                        </Text>
                                    )}
                                </VStack>
                            </>
                        ) : (
                            <>
                                <Text
                                    fontSize={{ base: "3xl", md: "4xl" }}
                                    fontWeight="bold"
                                    color="orange.400"
                                    textAlign="center"
                                    textShadow="0 0 20px rgba(251, 146, 60, 0.5)"
                                    animation="pulse 1s ease-in-out infinite"
                                >
                                    Thank you for your contribution! 🙏
                                </Text>
                                <Text
                                    fontSize={{ base: "xl", md: "2xl" }}
                                    color="gray.300"
                                    textAlign="center"
                                    fontWeight="medium"
                                >
                                    You were not lucky this time
                                </Text>
                                <Text
                                    fontSize={{ base: "lg", md: "xl" }}
                                    color="gray.400"
                                    textAlign="center"
                                >
                                    Maybe next time! 🍀
                                </Text>
                            </>
                        )}
                    </VStack>
                </VStack>
            )}

            {/* CSS Animations */}
            <style jsx global>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }

                @keyframes flame {
                    0%, 100% {
                        transform: scaleY(1) scaleX(1);
                        opacity: 0.7;
                    }
                    50% {
                        transform: scaleY(1.3) scaleX(0.8);
                        opacity: 0.9;
                    }
                }

                @keyframes fall {
                    from {
                        transform: translateY(0) rotate(0deg);
                        opacity: 1;
                    }
                    to {
                        transform: translateY(100vh) rotate(360deg);
                        opacity: 0.5;
                    }
                }

                @keyframes explosionScale {
                    from {
                        transform: scale(0);
                        opacity: 0;
                    }
                    to {
                        transform: scale(1);
                        opacity: 1;
                    }
                }

                @keyframes resultFadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes pulse {
                    0%, 100% {
                        transform: scale(1);
                    }
                    50% {
                        transform: scale(1.05);
                    }
                }

                @keyframes spin {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }

                @keyframes fadeInOut {
                    0% {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                ${[...Array(12)].map((_, i) => {
                    const angle = i * 30;
                    const distance = 150;
                    const x = Math.cos((angle * Math.PI) / 180) * distance;
                    const y = Math.sin((angle * Math.PI) / 180) * distance;
                    return `
                        @keyframes explode-${i} {
                            0% {
                                transform: translate(0, 0) scale(1);
                                opacity: 1;
                            }
                            100% {
                                transform: translate(${x}px, ${y}px) scale(0);
                                opacity: 0;
                            }
                        }
                    `;
                }).join('\n')}
            `}</style>
        </Box>
    );
};
