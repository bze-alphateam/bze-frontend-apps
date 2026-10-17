'use client';

import {IconButton} from '@chakra-ui/react';
import {LuLink} from 'react-icons/lu';
import {useToast} from '@bze/bze-ui-kit';
import {buildStakeLink} from '@/lib/stake-link';

interface CopyStakeLinkButtonProps {
    operatorAddress: string;
}

// A small, muted icon: copying a stake link is a side feature, so it stays out of the way in
// the validator rows and next to the delegate form's title.
export function CopyStakeLinkButton({operatorAddress}: CopyStakeLinkButtonProps) {
    const {toast} = useToast();

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(buildStakeLink(window.location.origin, operatorAddress));
            toast.success('Stake link copied', 'Anyone opening it lands on the stake form for this validator.');
        } catch {
            toast.error('Could not copy the link', 'Your browser blocked clipboard access.');
        }
    };

    return (
        <IconButton
            size="2xs"
            variant="ghost"
            color="fg.subtle"
            _hover={{color: 'fg.muted'}}
            aria-label="Copy stake link"
            title="Copy stake link"
            onClick={copy}
        >
            <LuLink />
        </IconButton>
    );
}
