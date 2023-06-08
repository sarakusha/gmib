import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import RemoveIcon from '@mui/icons-material/Remove';
import type { TypographyProps } from '@mui/material';
import {
  Avatar,
  Badge,
  Checkbox,
  IconButton,
  ListItem,
  ListItemAvatar,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';

import type { MediaInfo } from '/@common/mediaInfo';

import { css, styled } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import dayjs from 'dayjs';
import type { XYCoord } from 'dnd-core';
import type { CSSProperties } from 'react';
import React from 'react';
import { useDrag, useDrop } from 'react-dnd';
// import type { ListChildComponentProps } from 'react-window';

import { getUrl } from '/@common/remote';

import { formatTime, ItemTypes } from '../utils';

import Numbered from './Numbered';

const Thumbnail = styled(Avatar)(({ theme }) => ({
  width: 52,
  height: 40,
  marginRight: theme.spacing(1),
  userDrag: 'none',
  pointerEvents: 'none',
}));

const ListItemHover = styled(ListItem)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  borderLeft: '4px solid transparent',
  // borderRadius: theme.shape.borderRadius,
  borderTopLeftRadius: theme.shape.borderRadius,
  borderBottomLeftRadius: theme.shape.borderRadius,
  // borderRight: '1px solid transparent',
  // backgroundClip: 'padding-box',
  paddingLeft: theme.spacing(1),
  '&:hover': {
    // boxSizing: 'border-box',
    // textDecoration: 'none',
    backgroundColor: theme.palette.action.hover,
    borderLeftColor: theme.palette.secondary.main,
    // borderRightColor: theme.palette.divider,
    // Reset on touch devices, it doesn't add specificity
    '@media (hover: none)': {
      backgroundColor: 'transparent',
    },
  },
  '&:hover ~ * svg, & ~ *:hover svg': {
    opacity: 1,
  },
}));

export type MediaItemProps = {
  id?: string;
  media: MediaInfo;
  onDelete?: (id: string) => void;
  style?: CSSProperties;
  selected?: boolean;
  onSelect?: (md5: string, selected: boolean) => void;
  count?: number;
  onChange?: (md5: string, count: number) => void;
  onClick?: (md5: string) => void;
  pos?: number;
  index?: number;
  total?: number;
  onMove?: (from: number, to: number) => void;
  onMoveFinished?: () => void;
  deleteTitle?: string;
};

/* const getDuration = (seconds: number): string => {
  const s = (seconds % 60).toFixed(0).toString().padStart(2, '0');
  const m = Math.floor((seconds / 60) % 60)
    .toString()
    .padStart(2, '0');
  const h = Math.floor(seconds / 3600);
  const short = `${m}:${s}`;
  return h > 0 ? `${h}:${short}` : short;
}; */

const humanFileSize = (size: number): string => {
  const i = Math.floor(Math.log(size) / Math.log(1024));
  return `${(size / 1024 ** i).toFixed(2)} ${['B', 'kB', 'MB', 'GB', 'TB'][i]}`;
};

const Column: React.FC<
  React.PropsWithChildren<{
    w?: number;
    disableShrink?: boolean;
    align?: TypographyProps['align'];
  }>
> = ({ w = 10, disableShrink = false, children, align = 'right' }) => (
  <Typography
    variant="body2"
    sx={{ flexBasis: `${w}ch`, ...(disableShrink && { flexShrink: 0 }) }}
    component="span"
    align={align}
    noWrap={!disableShrink}
  >
    {children}
  </Typography>
);

const Details: React.FC<MediaInfo> = ({ duration, height, width, size, uploadTime }) => {
  const full = useMediaQuery('(min-width:830px)');
  const m700 = useMediaQuery('(min-width:700px)');
  const m600 = useMediaQuery('(min-width:575px)');
  return (
    <Stack direction="row" component="span" sx={{ '& > * ~ *': { pl: 0.5 } }}>
      <Column w={1} disableShrink>
        &#128344;
      </Column>
      <Column w={5} disableShrink>
        {formatTime(duration)}
      </Column>
      {m600 && (
        <>
          <Column>{humanFileSize(size)}</Column>
          {m700 && (
            <Column align="center">
              {width}x{height}
            </Column>
          )}
          {full && <Column w={15}>{dayjs(uploadTime).format('YYYY.MM.DD HH:mm')}</Column>}
        </>
      )}
    </Stack>
  );
};

const stopPropagation: React.MouseEventHandler = e => e.stopPropagation();

const MediaItem = React.forwardRef<HTMLLIElement, MediaItemProps>((props, ref) => {
  const {
    id,
    style,
    onDelete,
    selected,
    onSelect,
    count,
    onChange,
    onClick,
    media: info,
    pos,
    onMove,
    onMoveFinished,
    deleteTitle,
  } = props;
  const { md5, thumbnail, duration, filename } = info;
  const refInner = React.useRef<HTMLLIElement>(null);
  React.useImperativeHandle(ref, () => refInner.current as HTMLLIElement);
  const [, drop] = useDrop<{ dragIndex: number }, void, { canDrop: boolean; isOver: boolean }>({
    accept: ItemTypes.Media,
    collect(monitor) {
      return { canDrop: monitor.canDrop(), isOver: monitor.isOver() };
    },
    hover(item, monitor) {
      const { dragIndex } = item;
      if (!onMove || !refInner.current) return;
      const hoverIndex = pos ?? 0;
      if (dragIndex === hoverIndex) return;
      const hoverBoundingRect = refInner.current?.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      const hoverClientY = (clientOffset as XYCoord).y - hoverBoundingRect.top;
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;
      onMove(dragIndex, hoverIndex);
      // eslint-disable-next-line no-param-reassign
      item.dragIndex = hoverIndex;
    },
  });
  const [{ isDragging }, drag, dragPreview] = useDrag({
    type: ItemTypes.Media,
    item: () => ({ dragIndex: pos ?? 0 }),
    collect: monitor => ({
      isDragging: monitor.isDragging(),
    }),
    options: {
      dropEffect: 'move',
    },
    previewOptions: { captureDraggingState: true, offsetX: 1000, offsetY: 1000 },
    canDrag: !!onMove,
    end: () => onMoveFinished?.(),
  });
  drag(drop(refInner));
  const DeleteCloseIcon = onMove ? CloseIcon : DeleteIcon;
  return (
    <div ref={dragPreview}>
      <ListItemHover
        ref={refInner}
        style={style}
        dense
        selected={selected || Boolean(count)}
        onClick={() => onClick?.(md5)}
        sx={{
          ...(onMove && { cursor: 'move' }),
          '&, & ~ *': { opacity: isDragging ? 0 : 1 },
        }}
      >
        {onSelect && (
          <ListItemIcon>
            <Checkbox
              tabIndex={-1}
              disableRipple
              color="secondary"
              checked={selected}
              onChange={e => onSelect(md5, e.target.checked)}
            />
          </ListItemIcon>
        )}
        <ListItemAvatar>
          <Thumbnail
            variant="rounded"
            src={thumbnail && getUrl(`/public/${thumbnail?.replace(/^.*[\\/]/, '')}`)}
          />
        </ListItemAvatar>
        <ListItemText
          id={filename}
          primary={<Numbered text={filename} index={pos != null ? pos + 1 : undefined} />}
          primaryTypographyProps={{ noWrap: true }}
          secondary={duration ? <Details {...info} /> : 'loading...'}
          disableTypography
        />
        {onDelete && id && (
          <ListItemSecondaryAction onClick={stopPropagation} onMouseDown={stopPropagation}>
            <IconButton
              edge="end"
              aria-label="delete"
              onClick={() => onDelete(id)}
              sx={{ color: 'secondary.main' }}
              size="small"
              title={deleteTitle}
              tabIndex={-1}
            >
              <DeleteCloseIcon
                fontSize="inherit"
                css={css`
                  opacity: 0;
                `}
              />
            </IconButton>
          </ListItemSecondaryAction>
        )}
        {onChange && (
          <ListItemSecondaryAction onClick={stopPropagation} onMouseDown={stopPropagation}>
            <Stack direction="column">
              <IconButton size="small" edge="start" onClick={() => onChange(md5, (count ?? 0) + 1)}>
                <AddIcon fontSize="inherit" />
              </IconButton>
              <Badge badgeContent={count} color="secondary">
                <IconButton
                  size="small"
                  edge="start"
                  onClick={() => count && onChange(md5, count - 1)}
                >
                  <RemoveIcon fontSize="inherit" />
                </IconButton>
              </Badge>
            </Stack>
          </ListItemSecondaryAction>
        )}
      </ListItemHover>
    </div>
  );
});

MediaItem.displayName = 'MediaItem';

// export const renderMediaItem = ({
//   index,
//   style,
//   data,
// }: ListChildComponentProps<MediaItemProps[]>) => <MediaItem style={style} {...data[index]} />;

export default React.memo(MediaItem);
