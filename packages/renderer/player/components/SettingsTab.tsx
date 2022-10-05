import CloseIcon from '@mui/icons-material/Close';
import TabContext from '@mui/lab/TabContext';
import MuiTreeItem, { type TreeItemProps } from '@mui/lab/TreeItem';
import MuiTreeView, { type TreeViewProps } from '@mui/lab/TreeView';
import {
  Box,
  Collapse,
  Container,
  IconButton,
  Stack,
  SvgIcon,
  type SvgIconProps,
  Typography,
} from '@mui/material';
import * as React from 'react';
import { TransitionGroup } from 'react-transition-group';

import { getDisplayLabel } from '/@common/video';

import { useDisplays } from '../../common/displays';
import { useDeletePlayerMutation, usePlayers } from '../api/player';
import { PlayerMappingDialogProvider } from '../hooks/usePlayerMappingDialog';
import useShiftAlert from '../hooks/useShiftAlert';
import { useDispatch, useSelector } from '../store';
import { setSettingsNode } from '../store/currentSlice';
import { selectSettingsNode } from '../store/selectors';

import FixedHeadLayout from './FixedHeadLayout';
import OutputSettings from './OutputSettings';
import PlayerSettings from './PlayerSettings';
import SettingsToolbar from './SettingsToolbar';
import TabPanel from './TabPanel';

const MinusSquare: React.FC<SvgIconProps> = props => (
  <SvgIcon fontSize="inherit" style={{ width: 14, height: 14 }} {...props}>
    {/* tslint:disable-next-line: max-line-length */}
    <path d="M22.047 22.074v0 0-20.147 0h-20.12v0 20.147 0h20.12zM22.047 24h-20.12q-.803 0-1.365-.562t-.562-1.365v-20.147q0-.776.562-1.351t1.365-.575h20.147q.776 0 1.351.575t.575 1.351v20.147q0 .803-.575 1.365t-1.378.562v0zM17.873 11.023h-11.826q-.375 0-.669.281t-.294.682v0q0 .401.294 .682t.669.281h11.826q.375 0 .669-.281t.294-.682v0q0-.401-.294-.682t-.669-.281z" />
  </SvgIcon>
);

const PlusSquare: React.FC<SvgIconProps> = props => (
  <SvgIcon fontSize="inherit" style={{ width: 14, height: 14 }} {...props}>
    {/* tslint:disable-next-line: max-line-length */}
    <path d="M22.047 22.074v0 0-20.147 0h-20.12v0 20.147 0h20.12zM22.047 24h-20.12q-.803 0-1.365-.562t-.562-1.365v-20.147q0-.776.562-1.351t1.365-.575h20.147q.776 0 1.351.575t.575 1.351v20.147q0 .803-.575 1.365t-1.378.562v0zM17.873 12.977h-4.923v4.896q0 .401-.281.682t-.682.281v0q-.375 0-.669-.281t-.294-.682v-4.896h-4.923q-.401 0-.682-.294t-.281-.669v0q0-.401.281-.682t.682-.281h4.923v-4.896q0-.401.294-.682t.669-.281v0q.401 0 .682.281t.281.682v4.896h4.923q.401 0 .682.281t.281.682v0q0 .375-.281.669t-.682.294z" />
  </SvgIcon>
);

const CloseSquare: React.FC<SvgIconProps> = props => (
  <SvgIcon
    className="close"
    fontSize="inherit"
    style={{ width: 14, height: 14, opacity: 0.3 }}
    {...props}
  >
    {/* tslint:disable-next-line: max-line-length */}
    <path d="M17.485 17.512q-.281.281-.682.281t-.696-.268l-4.12-4.147-4.12 4.147q-.294.268-.696.268t-.682-.281-.281-.682.294-.669l4.12-4.147-4.12-4.147q-.294-.268-.294-.669t.281-.682.682-.281.696 .268l4.12 4.147 4.12-4.147q.294-.268.696-.268t.682.281 .281.669-.294.682l-4.12 4.147 4.12 4.147q.294.268 .294.669t-.281.682zM22.047 22.074v0 0-20.147 0h-20.12v0 20.147 0h20.12zM22.047 24h-20.12q-.803 0-1.365-.562t-.562-1.365v-20.147q0-.776.562-1.351t1.365-.575h20.147q.776 0 1.351.575t.575 1.351v20.147q0 .803-.575 1.365t-1.378.562v0z" />
  </SvgIcon>
);

const TreeView = React.forwardRef<TreeViewProps['ref'], React.PropsWithoutRef<TreeViewProps>>(
  (props, ref) => (
    <MuiTreeView
      defaultCollapseIcon={<MinusSquare />}
      defaultExpandIcon={<PlusSquare />}
      defaultEndIcon={<CloseSquare />}
      // defaultCollapseIcon={<ExpandMoreIcon />}
      // defaultExpandIcon={<ChevronRightIcon />}
      {...props}
      ref={ref}
    />
  ),
);

type StyledTreeItemProps = TreeItemProps & {
  onDelete?: React.MouseEventHandler<HTMLButtonElement>;
  bold?: boolean;
};

const TreeItem = React.forwardRef<TreeItemProps['ref'], React.PropsWithoutRef<StyledTreeItemProps>>(
  ({ onDelete, bold, ...props }, ref) => (
    <MuiTreeItem
      {...props}
      ref={ref}
      label={
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            '&:hover svg, & *:hover svg': { opacity: 1 },
            height: 32,
          }}
        >
          <Typography
            variant="body2"
            noWrap
            sx={{ flex: 1, minWidth: 0, fontWeight: bold ? 'bold' : 'inherit' }}
          >
            {props.label}
          </Typography>
          {onDelete && (
            <IconButton
              size="small"
              title="Удалить"
              onClick={onDelete}
              color="secondary"
              tabIndex={-1}
            >
              <CloseIcon fontSize="inherit" sx={{ opacity: 0 }} />
            </IconButton>
          )}
        </Box>
      }
    />
  ),
);

const SettingsTab: React.FC = () => {
  const { displays = [] } = useDisplays();
  const { players = [] } = usePlayers();
  const dispatch = useDispatch();
  const selected = useSelector(selectSettingsNode);
  const [deletePlayer] = useDeletePlayerMutation();
  const showAlert = useShiftAlert();
  const handleSelect = (e: React.SyntheticEvent, nodeId: string) => {
    dispatch(setSettingsNode(nodeId));
  };
  const deleteHandler = (id: number) => (e: React.MouseEvent<HTMLElement>) => {
    if (e.shiftKey) deletePlayer(id);
    else showAlert();
  };
  const [expanded, setExpanded] = React.useState<string[]>([]);
  const [group = '', id, index] = selected?.split(':', 3) ?? [];
  React.useEffect(() => {
    setExpanded(prev => (prev.some(nodeId => nodeId.startsWith(group)) ? prev : [...prev, group]));
  }, [selected, group]);
  return (
    <Container maxWidth="sm" disableGutters sx={{ height: 1, width: 1, display: 'flex' }}>
      <PlayerMappingDialogProvider>
        <FixedHeadLayout gap={0}>
          <SettingsToolbar group={group} id={+id} />
          <Stack direction="row" gap={1} sx={{ height: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <TreeView
                selected={selected}
                onNodeSelect={handleSelect}
                expanded={expanded}
                onNodeToggle={(_, ids) => setExpanded(ids)}
              >
                <TreeItem nodeId="players" label="Плееры">
                  <TransitionGroup>
                    {players.map(player => (
                      <Collapse key={player.id}>
                        <TreeItem
                          nodeId={`players:${player.id}`}
                          label={player.name}
                          onDelete={deleteHandler(player.id)}
                        />
                      </Collapse>
                    ))}
                  </TransitionGroup>
                </TreeItem>
                <TreeItem nodeId="displays" label="Устройства вывода">
                  <TransitionGroup>
                    {displays.map((display, i) => (
                      <Collapse key={display.id}>
                        <TreeItem
                          nodeId={`displays:${display.id}:${i}`}
                          label={getDisplayLabel(display, i)}
                          bold={display.primary}
                        />
                      </Collapse>
                    ))}
                  </TransitionGroup>
                </TreeItem>
              </TreeView>
            </Box>
            <Box sx={{ flex: 2, height: 1 }}>
              <TabContext value={group}>
                <TabPanel value="players" dense>
                  <PlayerSettings id={Number(id)} />
                </TabPanel>
                <TabPanel value="displays" dense>
                  <OutputSettings id={Number(id)} index={Number(index)} />
                </TabPanel>
              </TabContext>
            </Box>
          </Stack>
        </FixedHeadLayout>
      </PlayerMappingDialogProvider>
    </Container>
  );
};

export default SettingsTab;
