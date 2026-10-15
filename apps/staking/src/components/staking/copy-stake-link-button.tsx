'use client';

import {Button, IconButton} from '@chakra-ui/react';
import {LuLink} from 'react-icons/lu';
import {useToast} from '@bze/bze-ui-kit';
import {buildStakeLink} from '@/lib/stake-link';

interface CopyStakeLinkButtonProps {
    operatorAddress: string;
    // "icon" for validator rows, "text" inside the delegate form.
    variant?: 'icon' | 'text';
}

export function CopyStakeLinkButton({operatorAddress, variant = 'icon'}: CopyStakeLinkButtonProps) {
    const {toast} = useToast();

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(buildStakeLink(window.location.origin, operatorAddress));
            toast.success('Stake link copied', 'Anyone opening it lands on the stake form for this validator.');
        } catch {
            toast.error('Could not copy the link', 'Your browser blocked clipboard access.');
        }
    };

    if (variant === 'text') {
        return (
            <Button size="xs" variant="ghost" onClick={copy}>
                <LuLink /> Copy stake link
            </Button>
        );
    }

    return (
        <IconButton
            size="xs"
            variant="ghost"
            aria-label="Copy stake link"
            title="Copy stake link"
            onClick={copy}
        >
            <LuLink />
        </IconButton>
    );
}
