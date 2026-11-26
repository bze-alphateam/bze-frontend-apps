import {Fragment} from 'react';
import {chakra} from '@chakra-ui/react';
import {linkify} from '@/lib/dao-text';

/** Untrusted text (a proposal's summary, a DAO's description) as plain text: line breaks kept, links only for http(s). Never HTML. */
export const PlainText = ({text, testId, color}: {text: string; testId?: string; color?: string}) => (
    <chakra.p m="0" fontSize="15px" lineHeight="1.6" color={color} whiteSpace="pre-wrap" overflowWrap="anywhere" data-testid={testId}>
        {linkify(text).map((segment, i) => segment.kind === 'link'
            ? <chakra.a key={i} href={segment.href} target="_blank" rel="noopener noreferrer nofollow ugc" color="hg.link" textDecoration="underline">{segment.text}</chakra.a>
            : <Fragment key={i}>{segment.text}</Fragment>)}
    </chakra.p>
);
