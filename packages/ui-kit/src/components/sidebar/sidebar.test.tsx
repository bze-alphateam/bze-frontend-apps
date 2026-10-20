// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';

import { createHiveGlowSystem } from '../../theme';
import { rulesFor } from '../../test-support/css-rules';
import { Sidebar } from './sidebar';

const wrapper = ({ children }: { children: ReactNode }) => (
    <ChakraProvider value={createHiveGlowSystem('dex')}>{children}</ChakraProvider>
);

afterEach(cleanup);

describe('Sidebar', () => {
    it('opens above the sticky header, so its title and close button stay visible', () => {
        render(
            <Sidebar trigger={<button type="button">Open</button>} ariaLabel="Settings">
                <p>body</p>
            </Sidebar>,
            { wrapper },
        );

        fireEvent.click(screen.getByRole('button', { name: 'Open' }));

        const drawer = screen.getByRole('complementary', { name: 'Settings' });
        expect(rulesFor(screen.getByTestId('sidebar-backdrop'))).toMatch(/z-index:\s*var\(--chakra-z-index-overlay\)/);
        expect(rulesFor(drawer)).toMatch(/z-index:\s*var\(--chakra-z-index-modal\)/);
        expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Close sidebar' })).toBeTruthy();
    });
});
