'use client';

import {Box, Image} from '@chakra-ui/react';
import {LuUser} from 'react-icons/lu';

interface ValidatorAvatarProps {
    src?: string;
    name?: string;
    size?: string;
}

export function ValidatorAvatar({src, name, size = '32px'}: ValidatorAvatarProps) {
    if (!src) {
        return (
            <Box
                w={size}
                h={size}
                minW={size}
                borderRadius="full"
                bg="purple.500/10"
                display="flex"
                alignItems="center"
                justifyContent="center"
                color="purple.500"
            >
                <LuUser size={parseInt(size) * 0.5} />
            </Box>
        );
    }

    return (
        <Image
            src={src}
            alt={name ?? 'Validator'}
            w={size}
            h={size}
            minW={size}
            borderRadius="full"
            objectFit="cover"
            bg="purple.500/10"
            onError={(e) => {
                // Hide broken image, show fallback
                (e.target as HTMLImageElement).style.display = 'none';
            }}
        />
    );
}
