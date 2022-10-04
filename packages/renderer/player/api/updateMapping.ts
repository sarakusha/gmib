import type { SetStateAction } from 'react';

import createDebouncedAsyncThunk from '/@common/createDebouncedAsyncThunk';
import type { PlayerMapping } from '/@common/video';

import type { AppThunk, AppThunkConfig } from '../store';

import mappingApi, { mappingAdapter, selectMappingById } from './mapping';

const debouncedUpdateMapping = createDebouncedAsyncThunk<void, PlayerMapping, AppThunkConfig>(
  'mappingApi/pendingUpdate',
  (mapping, { dispatch }) => {
    dispatch(mappingApi.endpoints.updateMapping.initiate(mapping));
  },
  200,
  { selectId: mapping => mapping.id, maxWait: 500 },
);

const updateMapping =
  (id: number, update: SetStateAction<PlayerMapping>): AppThunk =>
  (dispatch, getState) => {
    dispatch(
      mappingApi.util.updateQueryData('getMappings', undefined, draft => {
        const prev = selectMappingById(draft, id);
        if (!prev) throw new Error(`Unknown player mapping: ${id}`);
        const mapping = typeof update === 'function' ? update(prev) : prev;
        mappingAdapter.setOne(draft, { ...mapping, id });
        dispatch(debouncedUpdateMapping(mapping));
      }),
    );
  };

export default updateMapping;
