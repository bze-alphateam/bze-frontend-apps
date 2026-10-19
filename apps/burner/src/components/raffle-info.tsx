import {chakra, Flex, Grid} from "@chakra-ui/react";
import {LuDices, LuFlame, LuLightbulb, LuTrophy} from "react-icons/lu";
import type {ReactNode} from "react";
import {Notice} from "@bze/bze-ui-kit";

const STEPS: { lead: string; rest: string }[] = [
    {lead: 'Make a contribution', rest: 'by burning tokens - your tokens are permanently removed from circulation'},
    {lead: 'Each contribution gives you a chance to win', rest: 'the blockchain automatically determines winners after 2 blocks'},
    {lead: 'Multiple contributions = more chances', rest: 'each one gives you another opportunity to win in consecutive blocks'},
    {lead: 'Winners receive rewards', rest: 'win a percentage of the raffle pot as a thank you for contributing'},
    {lead: 'Remaining pot gets burned', rest: 'when the raffle ends, all unclaimed tokens are permanently destroyed'},
];

const BENEFITS: { icon: ReactNode; title: string; text: string }[] = [
    {icon: <LuFlame/>, title: 'Support the Ecosystem', text: 'Help reduce token supply'},
    {icon: <LuDices/>, title: 'Chance to Win', text: 'Each contribution is an opportunity'},
    {icon: <LuTrophy/>, title: 'Reward Potential', text: 'Win from the raffle pot'},
];

/** What burning raffles are, how they work and why join: the raffles page section and the info dialog. */
export const RaffleInfo = () => {
    return (
        <Flex direction="column" gap="20px">
            <chakra.p m="0" fontSize="15px" lineHeight="1.6" color="hg.text.secondary">
                Burning Raffles let you <chakra.strong color="fg">contribute to reducing token supply</chakra.strong> by permanently burning tokens. As a thank you for your contribution, <chakra.strong color="fg">you get a chance to win rewards</chakra.strong> from the raffle pot!
            </chakra.p>
            <Notice status="info" icon={<LuLightbulb/>}>
                This is a contribution mechanism, not gambling. Every contribution burns tokens to help the ecosystem. Winners receive a portion of the pot as a reward, while all tokens eventually get burned.
            </Notice>

            <Flex direction="column" gap="12px">
                <chakra.h3 m="0" fontSize="16px" fontWeight="700">How it works</chakra.h3>
                <chakra.ol m="0" p="0" listStyleType="none" display="flex" flexDirection="column" gap="10px">
                    {STEPS.map((step, i) => (
                        <chakra.li key={step.lead} display="flex" gap="12px" alignItems="flex-start" fontSize="14px" lineHeight="1.55" color="hg.text.secondary">
                            <Flex
                                as="span"
                                aria-hidden
                                boxSize="24px"
                                flex="none"
                                align="center"
                                justify="center"
                                borderRadius="8px"
                                fontSize="12px"
                                fontWeight="700"
                                bgImage="app"
                                color="hg.buttonText"
                            >
                                {i + 1}
                            </Flex>
                            <span><chakra.strong color="fg">{step.lead}</chakra.strong> - {step.rest}</span>
                        </chakra.li>
                    ))}
                </chakra.ol>
                <chakra.p m="0" px="14px" py="10px" borderRadius="hg.md" bg="hg.inset" fontSize="13px" color="hg.text.faint">
                    Example: 5 contributions = 5 separate chances to win, each checked in consecutive blocks after the 2-block delay
                </chakra.p>
            </Flex>

            <Grid templateColumns={{base: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))'}} gap="12px">
                {BENEFITS.map(benefit => (
                    <Flex key={benefit.title} gap="12px" align="center" px="16px" py="14px" borderRadius="14px" bg="hg.inset">
                        <Flex
                            as="span"
                            aria-hidden
                            boxSize="36px"
                            flex="none"
                            align="center"
                            justify="center"
                            borderRadius="10px"
                            bg="app.subtle"
                            color="hg.accent"
                            css={{'& svg': {width: '18px', height: '18px'}}}
                        >
                            {benefit.icon}
                        </Flex>
                        <Flex direction="column" gap="2px" minW="0">
                            <chakra.strong fontSize="14px">{benefit.title}</chakra.strong>
                            <chakra.span fontSize="13px" color="hg.text.faint">{benefit.text}</chakra.span>
                        </Flex>
                    </Flex>
                ))}
            </Grid>
        </Flex>
    );
};
