import {chakra, Flex} from "@chakra-ui/react";

interface ListingTitleProps {
    title: string
    subtitle?: string
}

/** A list's title and its muted subtitle. */
export const ListingTitle = (props: ListingTitleProps) => (
    <Flex direction="column" align="flex-start" gap="8px">
        <chakra.h2 m="0" fontSize={{base: '20px', md: '22px'}} fontWeight="700">
            {props.title}
        </chakra.h2>
        {props.subtitle && (
            <chakra.p m="0" fontSize="16px" color="hg.text.secondary">
                {props.subtitle}
            </chakra.p>
        )}
    </Flex>
);
