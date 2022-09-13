import { fetchBaseQuery } from '@reduxjs/toolkit/query';

const token = new URLSearchParams(window.location.search).get('access_token');

export default fetchBaseQuery({
  baseUrl: '/api',
  prepareHeaders: headers => {
    token && headers.set('authorization', `Bearer ${token}`);
    return headers;
  },
});
