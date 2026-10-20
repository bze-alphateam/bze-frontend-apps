import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {ChakraProvider, Input} from '@chakra-ui/react';
import {createHiveGlowSystem} from '../theme';
import {rulesFor} from '../test-support/css-rules';
import {MaxInputGroup} from './max-input-group';

const renderGroup = (onMax = vi.fn(), maxDisabled = false) => render(
    <ChakraProvider value={createHiveGlowSystem('dex')}>
        <MaxInputGroup onMax={onMax} maxDisabled={maxDisabled}>
            <Input size="sm" placeholder="Amount"/>
        </MaxInputGroup>
    </ChakraProvider>
);

describe('MaxInputGroup', () => {
    it('puts Max inside the input, over its right edge, not attached beside it', () => {
        renderGroup();
        const input = screen.getByPlaceholderText('Amount');
        const holder = screen.getByRole('button', {name: 'Max'}).parentElement as HTMLElement;

        expect(holder.parentElement).toBe(input.parentElement);
        expect(rulesFor(holder)).toMatch(/position:\s*absolute/);
        expect(rulesFor(holder)).toMatch(/inset-inline-end:\s*0/);
        expect(rulesFor(input)).toMatch(/padding-inline-end:\s*calc\(var\(--input-height\) - -28px\)/);
    });

    it('calls onMax when clicked', () => {
        const onMax = vi.fn();
        renderGroup(onMax);
        fireEvent.click(screen.getByRole('button', {name: 'Max'}));
        expect(onMax).toHaveBeenCalledOnce();
    });

    it('disables Max when asked', () => {
        renderGroup(vi.fn(), true);
        expect(screen.getByRole('button', {name: 'Max'})).toBeDisabled();
    });
});
