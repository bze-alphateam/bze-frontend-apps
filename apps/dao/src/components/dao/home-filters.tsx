'use client';

import {chakra, Flex, Switch} from '@chakra-ui/react';
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
        gap="8px"
        h={{base: '44px', md: '40px'}}
        px={{base: '14px', md: '12px'}}
        w={{base: '100%', md: '240px'}}
        borderRadius="12px"
        bg="hg.inset"
        borderWidth="1px"
        borderColor="hg.hairline"
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

/** My DAOs: the switch that narrows the table to the wallet's DAOs. */
export const MineSwitch = ({checked, onChange}: {checked: boolean; onChange: (checked: boolean) => void}) => (
    <Switch.Root
        checked={checked}
        onCheckedChange={(details) => onChange(details.checked)}
        h="40px"
        px="12px"
        gap="10px"
        borderRadius="12px"
        borderWidth="1px"
        borderColor={checked ? 'app.border' : 'hg.hairline'}
        bg={checked ? 'app.subtle' : 'hg.inset'}
        cursor="pointer"
        flex="none"
        data-testid="mine-switch"
    >
        <Switch.HiddenInput role="switch" />
        <Switch.Control bg="hg.switchOff" _checked={{bgImage: 'appButton'}}>
            <Switch.Thumb />
        </Switch.Control>
        <Switch.Label fontSize="13px" fontWeight="600" color={checked ? 'fg' : 'fg.muted'} whiteSpace="nowrap">My DAOs</Switch.Label>
    </Switch.Root>
);
