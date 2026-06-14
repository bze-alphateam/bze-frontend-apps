import {Heading, Text, VStack} from "@chakra-ui/react";
import React from "react";

interface ListingTitleProps {
    title: string
    subtitle?: string
}

export const ListingTitle = (props: ListingTitleProps) => {
    return (
        <VStack align="start" gap="4">
            <Heading size="xl">
                {props.title}
            </Heading>
            <Text color="gray.600" fontSize="lg">
                {props.subtitle}
            </Text>
        </VStack>
    )
}