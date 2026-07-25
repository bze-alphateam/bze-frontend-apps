'use client';

import {Container, Heading, Stack, Text} from "@chakra-ui/react";

export default function Home() {
    return (
        <Container maxW="4xl" py={{base: "12", md: "20"}}>
            <Stack gap="4" align="center" textAlign="center">
                <Heading size={{base: "2xl", md: "4xl"}}>Communities</Heading>
                <Text color="fg.muted" fontSize={{base: "md", md: "lg"}} maxW="2xl">
                    Every token created on the BeeZee blockchain gets its own dedicated page —
                    supply, staking rewards, burns, and a built-in way to get the token.
                    The token directory is being built right now, check back soon.
                </Text>
            </Stack>
        </Container>
    );
}
