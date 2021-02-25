/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AppThunk, RootState } from './index';
import config from '../util/config';
// import type { AsyncInitializer } from './asyncInitialMiddleware';

export interface LocationState {
  // address?: string;
  latitude?: number;
  longitude?: number;
  error?: string;
}

const initialState: LocationState = config.get('location') ?? {};

const locationSlice = createSlice({
  name: 'location',
  initialState,
  reducers: {
    // setAddress(state, { payload: address }: PayloadAction<string | undefined>) {
    //   state.address = address;
    // },
    setLatitude(state, { payload: latitude }: PayloadAction<number | undefined>) {
      state.latitude = latitude;
    },
    setLongitude(state, { payload: longitude }: PayloadAction<number | undefined>) {
      state.longitude = longitude;
    },
    setError(state, { payload: error }: PayloadAction<string | undefined>) {
      state.error = error;
    },
  },
});

/*
const options = {
  enableHighAccuracy: true,
  timeout: 5000,
  maximumAge: 0,
};

export const updateCurrentLocation: AsyncInitializer = dispatch => {
  const { setLongitude, setLatitude } = locationSlice.actions;
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      dispatch(setLatitude(coords.latitude));
      dispatch(setLongitude(coords.longitude));
    },
    err => {
      console.error(`error while get location ${err.message}`);
    },
    options
  );
};
*/

export const selectLocation = (state: RootState): LocationState => state.location;

const updateLocation = (type: 'setLatitude' | 'setLongitude', value: number): AppThunk => (
  dispatch,
  getState
) => {
  const { [type]: setValue, setError } = locationSlice.actions;
  dispatch(setValue(value));
  const { latitude, longitude } = selectLocation(getState());
  if (latitude !== undefined && longitude !== undefined) {
    try {
      config.set('location', {
        latitude,
        longitude,
      });
      dispatch(setError(undefined));
    } catch (err) {
      dispatch(setError(err.message));
    }
  } else config.delete('location');
};

export const setLatitude = (latitude: number): AppThunk => updateLocation('setLatitude', latitude);
export const setLongitude = (longitude: number): AppThunk =>
  updateLocation('setLongitude', longitude);

// export const { setAddress } = locationSlice.actions;

export default locationSlice.reducer;
