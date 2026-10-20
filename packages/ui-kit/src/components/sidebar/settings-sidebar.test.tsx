// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';

// The theme, settings, connection and fee tokens are fed directly; only the Appearance row is under test.
const { theme } = vi.hoisted(() => ({
    theme: { resolvedTheme: 'dark', setTheme: vi.fn() },
}));

vi.mock('next-themes', () => ({ useTheme: () => theme }));
vi.mock('../../hooks/useToast', () => ({ useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }) }));
vi.mock('../../hooks/useConnectionType', () => ({ useConnectionType: () => ({ connectionType: 'polling' }) }));
vi.mock('../../hooks/useFeeTokens', () => ({ useFeeTokens: () => ({ feeTokens: [], isLoading: false }) }));
vi.mock('../../hooks/useSettings', () => {
    const settings = { endpoints: { restEndpoint: 'https://rest.example', rpcEndpoint: 'https://rpc.example' }, preferredFeeDenom: 'ubze' };
    return {
        useSettings: () => ({
            settings, isLoaded: true, updateEndpoints: vi.fn(), updatePreferredFeeDenom: vi.fn(), defaultSettings: settings,
        }),
    };
});

import { createHiveGlowSystem } from '../../theme';
import { SettingsSidebarContent } from './settings-sidebar';

// The switch starts listening one tick after mount.
const renderDrawer = async () => {
    render(<SettingsSidebarContent />, { wrapper });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
};

const wrapper = ({ children }: { children: ReactNode }) => (
    <ChakraProvider value={createHiveGlowSystem('dex')}>{children}</ChakraProvider>
);

beforeEach(() => {
    theme.resolvedTheme = 'dark';
    theme.setTheme.mockReset();
});

afterEach(cleanup);

describe('SettingsSidebarContent dark mode', () => {
    it('a click on the "Dark Mode" text does not change the theme', async () => {
        await renderDrawer();
        fireEvent.click(screen.getByText('Dark Mode'));
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
        expect(theme.setTheme).not.toHaveBeenCalled();
    });

    it('the switch, named "Dark Mode", toggles the theme', async () => {
        await renderDrawer();
        const toggle = screen.getByRole('checkbox', { name: 'Dark Mode' });
        expect((toggle as HTMLInputElement).checked).toBe(true);

        fireEvent.click(toggle);
        await waitFor(() => expect(theme.setTheme).toHaveBeenCalledWith('light'));
    });
});
