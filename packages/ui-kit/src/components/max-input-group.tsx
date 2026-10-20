'use client';

import {Button, InputGroup, InputGroupProps} from '@chakra-ui/react';

export interface MaxInputGroupProps extends Omit<InputGroupProps, 'endElement' | 'endElementProps' | 'endOffset'> {
    onMax: () => void;
    maxDisabled?: boolean;
}

// An amount input with its Max shortcut inside the field, on the right edge.
// endOffset widens the input's right padding past the default element width so the
// typed amount never runs under the button.
export const MaxInputGroup = ({children, onMax, maxDisabled, ...groupProps}: MaxInputGroupProps) => (
    <InputGroup
        endOffset="-28px"
        endElementProps={{px: '6px'}}
        endElement={
            <Button
                variant="ghost"
                size="xs"
                color="hg.accent"
                fontWeight="700"
                letterSpacing="0.04em"
                px="8px"
                _hover={{bg: 'app.subtle'}}
                onClick={onMax}
                disabled={maxDisabled}
            >
                Max
            </Button>
        }
        {...groupProps}
    >
        {children}
    </InputGroup>
);
