'use client';

import {PageState} from '@bze/bze-ui-kit';

/** The node runs chain v8.2.x: there is no x/dao to read yet. */
export const Unsupported = () => (
    <PageState
        kind="empty"
        title="DAOs arrive with the v8.3.0 network upgrade"
        description="This network does not run the DAO module yet. Come back once it has upgraded."
    />
);
