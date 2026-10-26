import type { SystemStyleObject } from '@chakra-ui/react';

/**
 * A header nav item (Header board): 15 px, muted until hovered; the current page and an open
 * menu trigger take the hover fill. The active underline is drawn by AppHeader.
 */
export const navItemStyle: SystemStyleObject = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    px: '14px',
    py: '10px',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: '500',
    lineHeight: '1.2',
    color: 'hg.text.muted',
    bg: 'transparent',
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'color 0.15s, background 0.15s',
    _hover: { color: 'fg', textDecoration: 'none' },
    _focus: { outline: 'none' },
    _focusVisible: { outline: '2px solid', outlineColor: 'app.focusRing', outlineOffset: '2px' },
    _expanded: { color: 'fg', bg: 'hg.hoverFill' },
    _currentPage: { color: 'fg', bg: 'hg.hoverFill', fontWeight: '600' },
};
