// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';

import { createHiveGlowSystem } from '../../theme';
import {
    Change,
    Eyebrow,
    FeaturedCard,
    GradientText,
    HeroGlow,
    HgCard,
    HomeHero,
    IconTile,
    LoadingRow,
    Notice,
    PageContainer,
    PageHero,
    PageState,
    SegmentedTabs,
    StatCard,
    StatStrip,
    StatusPill,
} from './index';

afterEach(() => {
    cleanup();
});

const system = createHiveGlowSystem('dex');
const wrapper = ({ children }: { children: ReactNode }) => <ChakraProvider value={system}>{children}</ChakraProvider>;
const ui = (node: ReactNode) => render(node, { wrapper });

describe('layout', () => {
    it('PageContainer holds its content', () => {
        ui(<PageContainer data-testid="container">page</PageContainer>);
        expect(screen.getByTestId('container').textContent).toBe('page');
    });

    it.each(['home', 'inner'] as const)('HeroGlow is decorative at %s strength', (strength) => {
        ui(<HeroGlow strength={strength} />);
        const glow = screen.getByTestId('hero-glow');
        expect(glow.getAttribute('aria-hidden')).toBe('true');
        expect(glow.getAttribute('data-strength')).toBe(strength);
    });

    it('HeroGlow defaults to the home strength', () => {
        ui(<HeroGlow />);
        expect(screen.getByTestId('hero-glow').getAttribute('data-strength')).toBe('home');
    });

    it('GradientText keeps its word readable to assistive tech', () => {
        ui(<h1>Swap tokens <GradientText>instantly</GradientText></h1>);
        expect(screen.getByRole('heading').textContent).toBe('Swap tokens instantly');
    });
});

describe('heroes', () => {
    it('Eyebrow shows the app icon and the label', () => {
        ui(<Eyebrow app="dex">BeeZee DEX</Eyebrow>);
        const eyebrow = screen.getByTestId('eyebrow');
        expect(within(eyebrow).getByTestId('app-icon').getAttribute('data-app')).toBe('dex');
        expect(eyebrow.textContent).toBe('BeeZee DEX');
    });

    it('Eyebrow uses the small icon on inner pages', () => {
        ui(<Eyebrow app="burner" iconSize={24}>Burner</Eyebrow>);
        expect(screen.getByTestId('app-icon').getAttribute('data-cut')).toBe('small');
    });

    it('HomeHero renders every slot, left-aligned by default', () => {
        ui(
            <HomeHero
                eyebrow={<span>eyebrow</span>}
                title={<>Swap tokens <GradientText>instantly</GradientText></>}
                subtitle="Swap, trade and earn."
                primaryAction={<button>Start</button>}
                secondaryAction={<button>Learn</button>}
            >
                <span>stats</span>
            </HomeHero>,
        );
        const hero = screen.getByTestId('home-hero');
        expect(hero.getAttribute('data-align')).toBe('left');
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Swap tokens instantly');
        expect(screen.getByText('Swap, trade and earn.')).toBeTruthy();
        const actions = screen.getByTestId('home-hero-actions');
        expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Start', 'Learn']);
        expect(screen.getByText('stats')).toBeTruthy();
        expect(screen.getByText('eyebrow')).toBeTruthy();
    });

    it('HomeHero centres and drops empty slots', () => {
        ui(<HomeHero title="Burn" align="center" />);
        expect(screen.getByTestId('home-hero').getAttribute('data-align')).toBe('center');
        expect(screen.queryByTestId('home-hero-actions')).toBeNull();
        expect(screen.queryByRole('paragraph')).toBeNull();
    });

    it('PageHero renders title, subtitle and actions', () => {
        ui(<PageHero title="Pools" subtitle="Every pool." actions={<button>Add</button>} />);
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Pools');
        expect(screen.getByText('Every pool.')).toBeTruthy();
        expect(within(screen.getByTestId('page-hero-actions')).getByRole('button').textContent).toBe('Add');
    });

    it('PageHero without actions has no action area', () => {
        ui(<PageHero title="Pools" />);
        expect(screen.queryByTestId('page-hero-actions')).toBeNull();
    });
});

describe('cards', () => {
    it('HgCard marks interactive cards', () => {
        ui(<><HgCard data-testid="plain">a</HgCard><HgCard data-testid="link" interactive>b</HgCard></>);
        expect(screen.getByTestId('plain').hasAttribute('data-interactive')).toBe(false);
        expect(screen.getByTestId('link').hasAttribute('data-interactive')).toBe(true);
    });

    it('FeaturedCard wraps its content in the gradient edge', () => {
        ui(<FeaturedCard>swap box</FeaturedCard>);
        expect(screen.getByTestId('featured-card').textContent).toBe('swap box');
    });

    it.each([
        [2.4, 'up', '▲ up 2.40%'],
        [-1.25, 'down', '▼ down 1.25%'],
        [0, 'flat', '– 0.00%'],
    ])('Change %d reads %s', (value, direction, text) => {
        ui(<Change value={value} />);
        const change = screen.getByTestId('change');
        expect(change.getAttribute('data-direction')).toBe(direction);
        expect(change.textContent).toBe(text);
    });

    it('Change takes a custom format', () => {
        ui(<Change value={-3} format={(abs) => `${abs} BZE`} />);
        expect(screen.getByTestId('change').textContent).toBe('▼ down 3 BZE');
    });

    it('StatCard shows label, value and change', () => {
        ui(<StatCard label="24h volume" value="$1,200" change={5} />);
        const card = screen.getByTestId('stat-card');
        expect(card.textContent).toContain('24h volume');
        expect(screen.getByTestId('stat-value').textContent).toBe('$1,200');
        expect(screen.getByTestId('change').getAttribute('data-direction')).toBe('up');
        expect(screen.queryByTestId('icon-tile')).toBeNull();
    });

    it('StatCard puts its icon on an outlined tile', () => {
        ui(<StatCard label="Pools" value="12" icon={<svg data-testid="icon" />} />);
        expect(screen.getByTestId('icon-tile').getAttribute('data-variant')).toBe('outline');
        expect(screen.getByTestId('icon')).toBeTruthy();
    });

    it('StatCard shows shimmer while loading', () => {
        ui(<StatCard label="Pools" value="12" loading />);
        expect(screen.getByTestId('stat-card').getAttribute('aria-busy')).toBe('true');
        expect(screen.queryByTestId('stat-value')).toBeNull();
        expect(screen.getAllByTestId('shimmer')).toHaveLength(2);
    });

    it('StatStrip holds its cards', () => {
        ui(
            <StatStrip>
                <StatCard label="a" value="1" />
                <StatCard label="b" value="2" />
                <StatCard label="c" value="3" />
            </StatStrip>,
        );
        expect(within(screen.getByTestId('stat-strip')).getAllByTestId('stat-card')).toHaveLength(3);
    });

    it.each(['filled', 'outline'] as const)('IconTile %s is decorative', (variant) => {
        ui(<IconTile icon={<svg />} variant={variant} />);
        const tile = screen.getByTestId('icon-tile');
        expect(tile.getAttribute('data-variant')).toBe(variant);
        expect(tile.getAttribute('aria-hidden')).toBe('true');
    });
});

describe('status', () => {
    it.each(['info', 'warning', 'danger', 'success'] as const)('Notice %s shows its icon, title and body', (status) => {
        ui(<Notice status={status} title="Heads up">Body text</Notice>);
        const notice = screen.getByRole('note');
        expect(notice.getAttribute('data-status')).toBe(status);
        expect(notice.querySelector('svg')).toBeTruthy();
        expect(within(notice).getByText('Heads up')).toBeTruthy();
        expect(within(notice).getByText('Body text')).toBeTruthy();
    });

    it('Notice takes a custom icon', () => {
        ui(<Notice status="info" icon={<svg data-testid="custom" />}>x</Notice>);
        expect(screen.getByTestId('custom')).toBeTruthy();
    });

    it('StatusPill has a live dot only when in flight', () => {
        ui(<><StatusPill tone="info" live>In Progress</StatusPill><StatusPill tone="success">Completed</StatusPill></>);
        const [live, done] = screen.getAllByTestId('status-pill');
        expect(within(live).getByTestId('live-dot')).toBeTruthy();
        expect(within(done).queryByTestId('live-dot')).toBeNull();
        expect(done.getAttribute('data-tone')).toBe('success');
    });

    it('StatusPill has a neutral tone', () => {
        ui(<StatusPill tone="neutral" live>Ended</StatusPill>);
        expect(screen.getByTestId('status-pill').getAttribute('data-tone')).toBe('neutral');
        expect(screen.getByTestId('live-dot')).toBeTruthy();
    });

    it('SegmentedTabs selects on click and with the arrow keys', () => {
        const onChange = vi.fn();
        ui(
            <SegmentedTabs
                aria-label="Direction"
                value="deposit"
                onChange={onChange}
                options={[{ value: 'deposit', label: 'Deposit' }, { value: 'withdraw', label: 'Withdraw' }]}
            />,
        );
        expect(screen.getByRole('tablist', { name: 'Direction' })).toBeTruthy();
        const [deposit, withdraw] = screen.getAllByRole('tab');
        expect(deposit.getAttribute('aria-selected')).toBe('true');
        expect(withdraw.getAttribute('aria-selected')).toBe('false');
        expect(withdraw.tabIndex).toBe(-1);

        fireEvent.click(withdraw);
        expect(onChange).toHaveBeenLastCalledWith('withdraw');

        fireEvent.keyDown(deposit, { key: 'ArrowLeft' });
        expect(onChange).toHaveBeenLastCalledWith('withdraw');
        fireEvent.keyDown(deposit, { key: 'ArrowRight' });
        expect(onChange).toHaveBeenLastCalledWith('withdraw');
        expect(onChange).toHaveBeenCalledTimes(3);
    });

    it('LoadingRow announces its text', () => {
        ui(<LoadingRow>Finding the best route…</LoadingRow>);
        const row = screen.getByRole('status');
        expect(row.textContent).toContain('Finding the best route…');
        expect(within(row).getAllByTestId('shimmer')).toHaveLength(2);
    });

    it('PageState loading draws skeleton rows', () => {
        ui(<PageState kind="loading" rows={4} />);
        const state = screen.getByTestId('page-state');
        expect(state.getAttribute('aria-busy')).toBe('true');
        expect(screen.getAllByTestId('page-state-row')).toHaveLength(4);
    });

    it.each(['empty', 'not-found'] as const)('PageState %s shows title, text and action', (kind) => {
        ui(<PageState kind={kind} title="Nothing here yet" description="No orders." action={<button>Browse</button>} />);
        const state = screen.getByTestId('page-state');
        expect(state.getAttribute('data-kind')).toBe(kind);
        expect(state.getAttribute('role')).toBeNull();
        expect(within(state).getByText('Nothing here yet')).toBeTruthy();
        expect(within(state).getByText('No orders.')).toBeTruthy();
        expect(within(state).getByRole('button').textContent).toBe('Browse');
    });

    it('PageState error is announced', () => {
        ui(<PageState kind="error" title="Could not load pools" />);
        expect(screen.getByRole('alert').textContent).toContain('Could not load pools');
    });
});
