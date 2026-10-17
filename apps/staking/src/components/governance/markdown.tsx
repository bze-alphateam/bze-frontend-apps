'use client';

import {Box, Code, Heading, Link, List, Table, Text} from '@chakra-ui/react';
import ReactMarkdown, {type Components} from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {safeUrl} from '@/lib/governance/markdown';

// Text anyone can write on chain (a proposal's summary), shown as Markdown.
// Ported from BZE Scan's ui/src/components/ui/markdown.tsx. Raw HTML is
// dropped, never parsed into elements; links keep only http(s) and mailto
// URLs; images become links, so a summary loads nothing by itself.

const ExternalLink = ({href, children}: {href: string; children: React.ReactNode}) => (
    <Link href={href} target="_blank" rel="noopener noreferrer nofollow" color="purple.fg" textDecoration="underline" wordBreak="break-word">
        {children}
    </Link>
);

const components: Components = {
    h1: ({children}) => <Heading as="h3" fontSize="lg" mt="2">{children}</Heading>,
    h2: ({children}) => <Heading as="h3" fontSize="lg" mt="2">{children}</Heading>,
    h3: ({children}) => <Heading as="h3" fontSize="lg" mt="2">{children}</Heading>,
    h4: ({children}) => <Heading as="h4" fontSize="md" mt="1">{children}</Heading>,
    h5: ({children}) => <Heading as="h5" fontSize="sm">{children}</Heading>,
    h6: ({children}) => <Heading as="h6" fontSize="sm">{children}</Heading>,
    p: ({children}) => <Text>{children}</Text>,
    a: ({href, children}) => (href ? <ExternalLink href={href}>{children}</ExternalLink> : <>{children}</>),
    img: ({src, alt}) => {
        const href = typeof src === 'string' ? safeUrl(src) : '';
        const label = alt || 'image';
        return href ? <ExternalLink href={href}>{label}</ExternalLink> : <>{label}</>;
    },
    ul: ({children}) => <List.Root ps="5">{children}</List.Root>,
    ol: ({children}) => <List.Root as="ol" ps="5" listStyleType="decimal">{children}</List.Root>,
    li: ({children}) => <List.Item>{children}</List.Item>,
    blockquote: ({children}) => (
        <Box borderStartWidth="3px" borderColor="border.emphasized" ps="3" color="fg.muted">{children}</Box>
    ),
    code: ({children}) => <Code fontSize="xs" whiteSpace="pre-wrap" wordBreak="break-word">{children}</Code>,
    pre: ({children}) => (
        <Box as="pre" bg="bg.muted" p="3" borderRadius="md" overflowX="auto" fontSize="xs">{children}</Box>
    ),
    hr: () => <Box as="hr" borderColor="border" />,
    table: ({children}) => (
        <Box overflowX="auto" maxW="full">
            <Table.Root size="sm" variant="outline">{children}</Table.Root>
        </Box>
    ),
    thead: ({children}) => <Table.Header>{children}</Table.Header>,
    tbody: ({children}) => <Table.Body>{children}</Table.Body>,
    tr: ({children}) => <Table.Row>{children}</Table.Row>,
    th: ({children}) => <Table.ColumnHeader>{children}</Table.ColumnHeader>,
    td: ({children}) => <Table.Cell>{children}</Table.Cell>,
};

/** Untrusted Markdown, rendered safely (see above). */
export function Markdown({text}: {text: string}) {
    return (
        <Box fontSize={{base: 'sm', md: 'md'}} wordBreak="break-word" display="flex" flexDirection="column" gap="3" data-testid="markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={safeUrl} components={components}>
                {text}
            </ReactMarkdown>
        </Box>
    );
}
