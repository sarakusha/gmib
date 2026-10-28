import { supportsFeature } from '/@common/capabilities';
import { parsePlayerConfiguration } from '/@common/playerConfiguration';
import { isRemoteSession, version } from '/@common/remote';

import mappingApi from './mapping';
import playerApi from './player';

type Configuration = ReturnType<typeof parsePlayerConfiguration>;
const unsupported = () => ({
  error: {
    status: 'CUSTOM_ERROR' as const,
    error: 'Перенос конфигураций требует GMIB 5.6.10 или новее на удалённом устройстве.',
  },
});

const configurationApi = playerApi.injectEndpoints({
  endpoints: build => ({
    exportConfiguration: build.mutation<Configuration, void>({
      async queryFn(_, api, extra, query) {
        if (!supportsFeature('playerConfiguration', version, isRemoteSession)) return unsupported();
        const result = await query('/player-configuration');
        if (result.error) return { error: result.error };
        try {
          return { data: parsePlayerConfiguration(result.data) };
        } catch (error) {
          return { error: { status: 'CUSTOM_ERROR', error: String(error) } };
        }
      },
    }),
    importConfiguration: build.mutation<
      { playerIds: number[]; mappingCount: number },
      Configuration
    >({
      async queryFn(configuration, api, extra, query) {
        if (!supportsFeature('playerConfiguration', version, isRemoteSession)) return unsupported();
        let body: Configuration;
        try {
          body = parsePlayerConfiguration(configuration);
        } catch (error) {
          return { error: { status: 'CUSTOM_ERROR', error: String(error) } };
        }
        const result = await query({ url: '/player-configuration', method: 'POST', body });
        if (result.error) return { error: result.error };
        return { data: result.data as { playerIds: number[]; mappingCount: number } };
      },
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch {
          // A lost response can follow a successful commit: refresh even on failure.
        } finally {
          if (supportsFeature('playerConfiguration', version, isRemoteSession)) {
            void dispatch(
              playerApi.endpoints.getPlayers.initiate(undefined, {
                subscribe: false,
                forceRefetch: true,
              }),
            );
            void dispatch(
              mappingApi.endpoints.getMappings.initiate(undefined, {
                subscribe: false,
                forceRefetch: true,
              }),
            );
          }
        }
      },
    }),
  }),
});

export const { useExportConfigurationMutation, useImportConfigurationMutation } = configurationApi;
export default configurationApi;
