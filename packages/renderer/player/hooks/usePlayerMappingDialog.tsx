import * as React from 'react';
import PlayerMappingDialog from '../dialogs/PlayerMappingDialog';

type Context = (playerId: number, id?: number) => void;

const PlayerMappingDialogContext = React.createContext<Context>(() => {});

export const PlayerMappingDialogProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [open, setOpen] = React.useState(false);
  const [params, setParams] = React.useState<{ playerId?: number; id?: number }>({});
  const openMappingDialog = React.useCallback<Context>((playerId, id) => {
    setParams({ playerId, id });
    setOpen(true);
  }, []);
  return (
    <PlayerMappingDialogContext.Provider value={openMappingDialog}>
      {children}
      <PlayerMappingDialog
        open={open}
        onClose={() => {
          setOpen(false);
          console.log('close');
        }}
        playerId={params.playerId}
        id={params.id}
      />
    </PlayerMappingDialogContext.Provider>
  );
};

const usePlayerMappingDialog = () => React.useContext(PlayerMappingDialogContext);

export default usePlayerMappingDialog;
