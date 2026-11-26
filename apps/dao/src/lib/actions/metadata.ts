import {buildUpdateDaoMetadataMsg, validateDaoDescription, validateDaoName} from '@bze/bze-ui-kit';
import type {ActionContext, ActionEntry, ActionFields} from './types';

export const METADATA_ID = 'update-metadata';

const validate = (fields: ActionFields, ctx: ActionContext): string | undefined => {
    const name = (fields.name ?? '').trim();
    const description = (fields.description ?? '').trim();
    const problem = validateDaoName(name) ?? validateDaoDescription(description);
    if (problem) return problem;
    if (name === ctx.dao.name && description === ctx.dao.description) return 'Change the name or the description: both are the same as today.';
    return undefined;
};

/** Rename the DAO or change its description: the DAO's own account signs (a proposal or its admin runs it). */
export const metadataEntry: ActionEntry = {
    id: METADATA_ID,
    label: 'Rename the DAO or change its description',
    description: 'Replace the name and the description shown on the DAO page.',
    available: () => true,
    initialFields: (ctx) => ({name: ctx.dao.name, description: ctx.dao.description}),
    validate,
    build(fields, ctx) {
        const problem = validate(fields, ctx);
        if (problem) throw new Error(problem);
        return buildUpdateDaoMetadataMsg({
            daoAddress: ctx.dao.address,
            daoId: ctx.dao.id,
            name: (fields.name ?? '').trim(),
            description: (fields.description ?? '').trim(),
        });
    },
};
