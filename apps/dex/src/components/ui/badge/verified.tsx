import {Badge, HStack, Text} from "@chakra-ui/react";
import {LuShield} from "react-icons/lu";
import React from "react";

export const VerifiedBadge = () => {
  return (
      <Badge colorPalette={'green'} variant="subtle">
          <HStack gap="1">
              <LuShield size={12} />
              <Text>Verified</Text>
          </HStack>
      </Badge>
  )
}
