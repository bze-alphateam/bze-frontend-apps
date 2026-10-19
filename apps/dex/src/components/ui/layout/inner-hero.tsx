import {Box, chakra, Flex} from "@chakra-ui/react";
import {Eyebrow, HeroGlow, PageContainer, PageHero} from "@bze/bze-ui-kit";
import type {ReactNode} from "react";

interface InnerHeroProps {
    /** The part after "BeeZee DEX · ": "Pools", "Assets", "Staking". */
    section: string;
    title: ReactNode;
    /** A tag next to the title, e.g. the AMM venue tag. */
    tag?: ReactNode;
    subtitle?: ReactNode;
    /** A quiet line or link on the right. */
    aside?: ReactNode;
}

/** The band at the top of an inner DEX page: the half-strength glow, the eyebrow, the title. */
export const InnerHero = ({section, title, tag, subtitle, aside}: InnerHeroProps) => (
    <Box position="relative" overflow="hidden" borderBottomWidth="1px" borderColor="hg.divider">
        <HeroGlow strength="inner"/>
        <PageContainer position="relative" zIndex="1" pt={{base: '32px', md: '44px'}} pb="36px">
            <PageHero
                eyebrow={<Eyebrow app="dex" iconSize={24}>BeeZee DEX · {section}</Eyebrow>}
                title={tag ? (
                    <Flex as="span" align="center" gap="12px" wrap="wrap">{title}{tag}</Flex>
                ) : title}
                subtitle={subtitle}
                actions={typeof aside === 'string'
                    ? <chakra.span fontSize="13px" color="hg.text.faint">{aside}</chakra.span>
                    : aside}
            />
        </PageContainer>
    </Box>
);

/** A small count pill: "[n] liquidity pools". */
export const CountPill = ({children}: { children: ReactNode }) => (
    <chakra.span
        fontSize="13px"
        fontWeight="600"
        px="12px"
        py="6px"
        borderRadius="full"
        color="hg.text.secondary"
        bg="hg.secondaryFill"
        borderWidth="1px"
        borderColor="hg.lineStrong"
        whiteSpace="nowrap"
    >
        {children}
    </chakra.span>
);
