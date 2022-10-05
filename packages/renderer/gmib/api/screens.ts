import { createEntityAdapter, type EntityState } from '@reduxjs/toolkit';
import { createApi } from '@reduxjs/toolkit/query/react';
import debugFactory from 'debug';
import type { SetStateAction } from 'react';

import baseQuery from '../../common/authBaseQuery';
import createDebouncedAsyncThunk from '../../common/createDebouncedAsyncThunk';

import type { Screen } from '/@common/video';
import { reAddress } from '/@common/config';
import type { ValueType, WithRequiredProp } from '/@common/helpers';
import { notEmpty, toErrorMessage } from '/@common/helpers';

import type { AppThunk, AppThunkConfig, RootState } from '../store';
import { setCurrentScreen } from '../store/currentSlice';
import { selectCurrentScreenId, selectDevicesByAddress } from '../store/selectors';

import Address from '@nibus/core/Address';

const debug = debugFactory(`${import.meta.env.VITE_APP_NAME}:screen`);

type Location = {
  address: Address;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
};

const safeNumber = (value: string | undefined): number | undefined =>
  value !== undefined ? +value : undefined;

export const parseLocation = (location: string): Location | undefined => {
  const matches = location.match(reAddress);
  if (!matches) return undefined;
  const [, address, l, t, w, h] = matches;
  return {
    address: new Address(address),
    left: safeNumber(l),
    top: safeNumber(t),
    width: safeNumber(w),
    height: safeNumber(h),
  };
};

const getHostParams =
  (screen: Screen) =>
  (expr: string): WithRequiredProp<Location, 'left' | 'top'> | undefined => {
    const location = parseLocation(expr);
    if (!location) return undefined;
    const { left = 0, top = 0, address } = location;
    const width = location.width ?? (screen.width && Math.max(screen.width - left, 0));
    const height = location.height ?? (screen.height && Math.max(screen.height - top, 0));
    return {
      address,
      left: screen.left + left,
      top: screen.top + top,
      width,
      height,
    };
  };

const adapter = createEntityAdapter<Screen>({
  selectId: ({ id }) => id,
});

export const {
  selectAll: selectScreens,
  selectById: selectScreen,
  selectTotal: selectTotalScreens,
} = adapter.getSelectors();

const screenApi = createApi({
  baseQuery,
  reducerPath: 'screenApi',
  tagTypes: ['screen', 'address'],
  endpoints: build => ({
    getScreens: build.query<EntityState<Screen>, void>({
      query: () => 'screen',
      transformResponse: (response: Screen[]) =>
        adapter.addMany(adapter.getInitialState(), response),
    }),
    createScreen: build.mutation<Screen, string | undefined | void>({
      query: name => ({
        url: 'screen',
        method: 'POST',
        body: { name: name ?? 'Новый экран' },
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(
          screenApi.util.updateQueryData('getScreens', undefined, state => {
            adapter.addOne(state, data);
          }),
        );
        dispatch(setCurrentScreen(data.id));
      },
    }),
    deleteScreen: build.mutation<void, number>({
      query: id => ({
        url: `screen/${id}`,
        method: 'DELETE',
      }),
      onQueryStarted(id, { dispatch, queryFulfilled, getState }) {
        const patchResult = dispatch(
          screenApi.util.updateQueryData('getScreens', undefined, state => {
            adapter.removeOne(state, id);
          }),
        );
        const current = selectCurrentScreenId(getState() as RootState);
        if (current === id) {
          dispatch(setCurrentScreen(undefined));
        }
        queryFulfilled.catch(patchResult.undo);
      },
      invalidatesTags: ['address'],
    }),
    updateScreen: build.mutation<Screen, Screen>({
      query: screen => ({
        url: 'screen',
        method: 'PUT',
        body: screen,
      }),
      async onQueryStarted(screen, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            screenApi.util.updateQueryData('getScreens', undefined, state => {
              adapter.setOne(state, data);
            }),
          );
          if (
            screen.addresses &&
            screen.addresses.filter(address => reAddress.test(address)).length
          ) {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            dispatch(updateMinihosts(screen.id));
          }
        } catch {
          dispatch(screenApi.endpoints.getScreens.initiate());
        }
      },
      invalidatesTags: ['address'],
    }),
    getAddresses: build.query<string[], void>({
      query: () => 'address',
      providesTags: ['address'],
      transformResponse: (response: string[]) =>
        response ? response.map(address => address.replace(/[+-].*$/, '')) : [],
    }),
  }),
});

export const {
  useGetScreensQuery,
  useCreateScreenMutation,
  useDeleteScreenMutation,
  useUpdateScreenMutation,
  useGetAddressesQuery,
} = screenApi;

const debouncedUpdateScreen = createDebouncedAsyncThunk<void, Screen, AppThunkConfig>(
  'screenApi/pendingUpdateScreen',
  (screen, { dispatch }) => {
    dispatch(screenApi.endpoints.updateScreen.initiate(screen));
  },
  200,
  { selectId: screen => screen.id, maxWait: 500 },
);

export const updateScreen =
  (id: number, update: SetStateAction<Omit<Screen, 'id'>>): AppThunk =>
  dispatch => {
    dispatch(
      screenApi.util.updateQueryData('getScreens', undefined, state => {
        const prev = selectScreen(state, id);
        if (!prev) throw new Error(`Unknown screen id: ${id}`);
        const screen = { id, ...(typeof update === 'function' ? update(prev) : update) };
        adapter.setOne(state, screen);
        dispatch(debouncedUpdateScreen(screen));
      }),
    );
  };

export const useScreens = () =>
  screenApi.useGetScreensQuery(undefined, {
    selectFromResult: ({ data, ...other }) => ({
      screens: data && selectScreens(data),
      ...other,
    }),
    pollingInterval: 3000,
  });

export const useScreen = (id?: number) =>
  screenApi.useGetScreensQuery(undefined, {
    skip: !id,
    selectFromResult: ({ data, ...other }) => ({
      screen: data && id ? selectScreen(data, id) : undefined,
      ...other,
    }),
    pollingInterval: 3000,
  });

const selectScreenData = screenApi.endpoints.getScreens.select();

export const updateMinihosts = createDebouncedAsyncThunk<void, number>(
  'updateMinihosts',
  async (scrId, { getState }) => {
    const state = getState() as RootState;
    const { data: screenData } = selectScreenData(state);
    const screen = screenData && selectScreen(screenData, scrId);
    if (screen && screen.addresses) {
      const {
        addresses,
        moduleWidth,
        moduleHeight,
        rightToLeft = false,
        downToTop = false,
      } = screen;
      const getParams = getHostParams(screen);
      try {
        addresses
          .filter(address => reAddress.test(address))
          .map(getParams)
          .filter(notEmpty)
          .forEach(({ address, left, top, width, height }) => {
            const target = new Address(address);
            const devices = selectDevicesByAddress(state, target);
            devices.filter(notEmpty).forEach(({ id, mib }) => {
              // debug(`initialize ${devAddress}`);
              const setValue = window.nibus.setDeviceValue(id);
              let props: Record<string, ValueType | undefined> = {};
              switch (mib) {
                case 'minihost3':
                  props = {
                    hoffs: left,
                    voffs: top,
                    ...(width && { hres: width }),
                    ...(height && { vres: height }),
                    ...(moduleWidth && { moduleHres: moduleWidth }),
                    ...(moduleHeight && { moduleVres: moduleHeight }),
                    indication: 0,
                    dirh: rightToLeft,
                    dirv: !downToTop,
                  };
                  break;
                case 'minihost_v2.06b':
                  props = {
                    hoffs: left,
                    voffs: top,
                    ...(width && { hres: width }),
                    ...(height && { vres: height }),
                    ...(moduleWidth && { moduleHres: moduleWidth }),
                    ...(moduleHeight && { moduleVres: moduleHeight }),
                    indication: 0,
                    hinvert: rightToLeft,
                    vinvert: !downToTop,
                  };
                  break;
                case 'mcdvi':
                  props = {
                    indication: 0,
                    ...(width && { hres: width }),
                    ...(height && { vres: height }),
                    hofs: left,
                    vofs: top,
                  };
                  break;
                default:
                  break;
              }
              Object.entries(props).forEach(([name, value]) => {
                // debug(`setValue ${name} = ${value}`);
                value !== undefined && value !== null && setValue(name, value);
              });
            });
          });
      } catch (err) {
        debug(`error while initialize screen ${screen.name}: ${toErrorMessage(err)}`);
      }
    }
  },
  400,
  {
    selectId: id => id,
    leading: true,
    maxWait: 1000,
  },
);

export default screenApi;
