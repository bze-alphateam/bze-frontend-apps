'use client';

import {Flex, Image} from '@chakra-ui/react';
import {useState} from 'react';
import {LuUser} from 'react-icons/lu';

interface ValidatorAvatarProps {
    src?: string;
    name?: string;
    size?: string;
}

/** The moniker's first two letters or digits, for the fallback disc. */
export const validatorInitials = (name?: string) => (name ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase();

/**
 * A validator's Keybase picture with a 1 px Staking-tinted ring; without one (or when it fails
 * to load) a neutral disc with the moniker's initials.
 */
export function ValidatorAvatar({src, name, size = '32px'}: ValidatorAvatarProps) {
    // The URL that failed, so a new logo for the same row gets its own try.
    const [failedSrc, setFailedSrc] = useState<string | undefined>();
    const px = parseInt(size);

    if (!src || failedSrc === src) {
        const initials = validatorInitials(name);
        return (
            <Flex
                as="span"
                aria-hidden
                boxSize={size}
                minW={size}
                flex="none"
                borderRadius="full"
                bg="hg.raised"
                borderWidth="1px"
                borderColor="app.border"
                align="center"
                justify="center"
                color="hg.text.secondary"
                fontSize={`${Math.round(px * 0.36)}px`}
                fontWeight="700"
                data-testid="validator-initials"
            >
                {initials || <LuUser size={px * 0.5} />}
            </Flex>
        );
    }

    return (
        <Image
            src={src}
            alt={name ?? 'Validator'}
            boxSize={size}
            minW={size}
            flex="none"
            borderRadius="full"
            objectFit="cover"
            bg="hg.raised"
            borderWidth="1px"
            borderColor="app.border"
            onError={() => setFailedSrc(src)}
        />
    );
}
