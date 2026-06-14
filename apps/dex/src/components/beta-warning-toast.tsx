'use client';

import { useEffect } from 'react';
import { useToast } from '@bze/bze-ui-kit';

const BETA_WARNING_KEY = 'bze-beta-warning-shown';

export function BetaWarningToast() {
  const { toast } = useToast();

  useEffect(() => {
    // Check if we've already shown the toast in this session
    const hasShownWarning = sessionStorage.getItem(BETA_WARNING_KEY);

    if (!hasShownWarning) {
      // Use setTimeout to move toast call outside React's render phase
      setTimeout(() => {
        toast.info(
          'Beta Version',
          'This application is in Beta phase and still under development. Features may change as we work towards the proper version.',
          15000 // Show for 15 seconds
        );
      }, 2000);

      // Mark that we've shown the warning
      sessionStorage.setItem(BETA_WARNING_KEY, 'true');
    }
  }, [toast]);

  // This component doesn't render anything
  return null;
}
