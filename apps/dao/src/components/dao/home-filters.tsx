'use client';

import {chakra, Flex} from '@chakra-ui/react';
import {LuSearch} from 'react-icons/lu';
import type {DaoKind} from '@/lib/dao-types';
import {kindLabel} from '@/lib/home-list';

const KIND_OPTIONS: {value: DaoKind | ''; label: string}[] = [
    {value: '', label: 'All'},
    {value: 'static_list', label: kindLabel('static_list')},
    {value: 'stake', label: kindLabel('stake')},
];

/** All / Member list / Stakers: three equal columns on a phone, labels never wrap. */
export const TypeFilter = ({value, onChange}: {value: DaoKind | ''; onChange: (value: DaoKind | '') => void}) => (
    <Flex
        role="group"
        aria-label="DAO type"
        display={{base: 'grid', md: 'inline-flex'}}
        gridTemplateColumns="repeat(3, minmax(0, 1fr))"
        gap="2px"
        p="3px"
        borderRadius="12px"
        bg="hg.inset"
        borderWidth="1px"
        borderColor="hg.hairline"
        data-testid="type-filter"
    >
        {KIND_OPTIONS.map((option) => {
            const on = option.value === value;
            return (
                <chakra.button
                    key={option.value || 'all'}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onChange(option.value)}
                    h={{base: '36px', md: '32px'}}
                    px={{base: '8px', md: '14px'}}
                    border="0"
                    borderRadius="9px"
                    fontSize="13px"
                    fontWeight="600"
                    whiteSpace="nowrap"
                    cursor="pointer"
                    bg={on ? 'hg.raised' : 'transparent'}
                    color={on ? 'fg' : 'fg.muted'}
                    boxShadow={on ? 'xs' : 'none'}
                    focusVisibleRing="outside"
                    _hover={on ? undefined : {color: 'fg'}}
                >
                    {option.label}
                </chakra.button>
            );
        })}
    </Flex>
);

/** The name search: 240 px wide on desktop, full width and 44 px high on a phone. */
export const SearchBox = ({value, onChange}: {value: string; onChange: (value: string) => void}) => (
    <chakra.label
        display="flex"
        alignItems="center"
        gap={{base: '10px', md: '8px'}}
        h={{base: '44px', md: '40px'}}
        px={{base: '14px', md: '12px'}}
        w={{base: '100%', md: '240px'}}
        borderRadius="12px"
        bg="hg.inset"
        borderWidth="1px"
        borderColor="hg.lineStrong"
        color="fg.muted"
        _focusWithin={{borderColor: 'app.border'}}
    >
        <LuSearch size={16} aria-hidden />
        <chakra.input
            type="search"
            aria-label="Search DAOs by name"
            placeholder="Search by name"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            flex="1"
            minW="0"
            bg="transparent"
            border="0"
            outline="none"
            color="fg"
            fontSize={{base: '15px', md: '14px'}}
            fontWeight="500"
        />
    </chakra.label>
);

/**
 * My DAOs: the switch that narrows the table to the wallet's DAOs. A button with the switch
 * role (C1 board): a 32 x 18 track with a 14 px knob, the DAO gradient when on.
 */
export const MineSwitch = ({checked, onChange}: {checked: boolean; onChange: (checked: boolean) => void}) => (
    <chakra.button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        display="inline-flex"
        alignItems="center"
        gap={{base: '8px', md: '10px'}}
        h="40px"
        ps={{base: '8px', md: '10px'}}
        pe={{base: '12px', md: '14px'}}
        borderRadius="12px"
        borderWidth="1px"
        borderColor={checked ? 'app.border' : 'hg.lineStrong'}
        bg={checked ? 'app.subtle' : 'hg.inset'}
        color={checked ? 'fg' : 'hg.text.secondary'}
        fontSize="13px"
        fontWeight="600"
        whiteSpace="nowrap"
        cursor="pointer"
        flex="none"
        focusVisibleRing="outside"
        data-testid="mine-switch"
        data-state={checked ? 'checked' : 'unchecked'}
    >
        <chakra.span aria-hidden position="relative" w="32px" h="18px" flex="none" borderRadius="hg.pill" {...(checked ? {bgImage: 'app'} : {bg: 'hg.switchOff'})}>
            <chakra.span position="absolute" top="2px" left={checked ? '16px' : '2px'} boxSize="14px" borderRadius="hg.pill" bg="white" transition="left 0.15s" />
        </chakra.span>
        My DAOs
    </chakra.button>
);
