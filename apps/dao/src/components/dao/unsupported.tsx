'use client';

import type {ReactNode} from 'react';
import {Box, chakra, Flex} from '@chakra-ui/react';
import {LuClock, LuUsers} from 'react-icons/lu';
import {AppLink, getExplorerBaseURL} from '@bze/bze-ui-kit';

interface StatePanelProps {
    icon: ReactNode;
    /** The DAO accent tile (the upgrade) or the neutral one (an empty list). */
    accent?: boolean;
    title: string;
    description: string;
    children?: ReactNode;
    testId?: string;
}

/** The C3 board's big state: a 56 px icon tile, a 22 px title, a line and what to do next. */
export const StatePanel = ({icon, accent, title, description, children, testId}: StatePanelProps) => (
    <Flex direction="column" align="center" textAlign="center" gap="12px" p="24px" minW="0" data-testid={testId}>
        <Flex
            as="span"
            aria-hidden
            boxSize="56px"
            align="center"
            justify="center"
            borderRadius="16px"
            {...(accent ? {bg: 'app.subtle', color: 'hg.link'} : {bg: 'hg.inset', color: 'fg.muted'})}
        >
            {icon}
        </Flex>
        <chakra.strong fontSize="22px" color="fg">{title}</chakra.strong>
        <chakra.p m="0" fontSize="15px" lineHeight="1.55" color="hg.text.secondary" maxW="480px">{description}</chakra.p>
        {children && <Flex gap="10px" align="center" justify="center" wrap="wrap">{children}</Flex>}
    </Flex>
);

/** The node runs chain v8.2.x: there is no x/dao to read yet. One state for the whole app. */
export const Unsupported = () => (
    <Box bg="hg.card" borderWidth="1px" borderColor="hg.hairline" borderRadius="hg.lg" boxShadow="hg.card" data-testid="unsupported">
        <StatePanel
            accent
            icon={<LuClock size={28} />}
            title="DAOs arrive with the v8.3.0 network upgrade"
            description="This network still runs v8.2. Once the upgrade lands, you'll find every DAO here."
        >
            <AppLink app="explorer" href={getExplorerBaseURL()}>Upgrade status on Explorer</AppLink>
        </StatePanel>
    </Box>
);

/** My DAOs is on and the wallet is in none of them. */
export const NotInAnyDao = ({action}: {action: ReactNode}) => (
    <StatePanel
        icon={<LuUsers size={28} />}
        title="You're not in any DAO yet"
        description="My DAOs is on and you're in none of them. Join one by staking in its rewards or by asking its members."
        testId="not-in-any-dao"
    >
        {action}
    </StatePanel>
);
