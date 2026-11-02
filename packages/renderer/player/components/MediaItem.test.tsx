import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type { MediaInfo } from '/@common/mediaInfo';
import MediaItem from './MediaItem';

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
vi.mock('react-dnd', () => ({
  useDrop: () => [{}, (node: unknown) => node],
  useDrag: () => [{ isDragging: false }, (node: unknown) => node, () => undefined],
}));
const media: MediaInfo = {
  md5: 'abc',
  filename: 'clip.mkv',
  original: { md5: 'abc', filename: 'clip.mp4' },
  duration: 10,
  size: 1024,
  streams: 1,
  width: 1920,
  height: 1080,
};

describe('media library download action', () => {
  it('places download left of delete and does not trigger row actions', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const download = vi.fn();
    const remove = vi.fn();
    const select = vi.fn();
    try {
      act(() =>
        root.render(
          <MediaItem
            id="abc"
            media={media}
            onDownload={download}
            onDelete={remove}
            onClick={select}
          />,
        ),
      );
      const buttons = [...container.querySelectorAll('button')];
      expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual([
        'Скачать clip.mkv на компьютер',
        'delete',
      ]);
      act(() => buttons[0].click());
      expect(download).toHaveBeenCalledWith(media);
      expect(remove).not.toHaveBeenCalled();
      expect(select).not.toHaveBeenCalled();
      act(() =>
        root.render(
          <MediaItem id="abc" media={media} onDownload={download} onDelete={remove} downloading />,
        ),
      );
      expect(container.querySelector('button')?.disabled).toBe(true);
      act(() => root.render(<MediaItem media={media} onDownload={download} onDelete={remove} />));
      expect(container.querySelector('button')).toBeNull();
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });
});
