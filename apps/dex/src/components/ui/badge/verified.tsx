import {chakra} from "@chakra-ui/react";
import {LuCheck} from "react-icons/lu";
import React from "react";

/** The verified mark next to an asset or market name, in the DEX accent. */
export const VerifiedBadge = () => {
  return (
      <chakra.span
          display="inline-flex"
          alignItems="center"
          gap="4px"
          fontSize="11px"
          fontWeight="600"
          lineHeight="1.4"
          px="8px"
          py="2px"
          borderRadius="full"
          color="hg.link"
          bg="app.subtle"
          borderWidth="1px"
          borderColor="app.border"
      >
          <LuCheck size={10} strokeWidth={3} aria-hidden="true"/>
          Verified
      </chakra.span>
  )
}
