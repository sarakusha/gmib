import FileUploadIcon from '@mui/icons-material/FileUpload';
import type { IconButtonProps } from '@mui/material/IconButton';
import IconButton from '@mui/material/IconButton';
import { styled } from '@mui/material/styles';
import React, { useCallback, useRef } from 'react';

const Input = styled('input')({
  display: 'none',
});

export type UploadButtonProps = {
  size?: IconButtonProps['size'];
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
};

const UploadButton: React.FC<UploadButtonProps> = ({ onChange, size }) => {
  const refInput = useRef<HTMLInputElement>(null);
  const resetHandler = useCallback((): void => {
    if (refInput.current) refInput.current.value = '';
  }, []);
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label htmlFor="icon-button-file">
      <Input
        ref={refInput}
        accept="image/*,video/*,.mkv"
        id="icon-button-file"
        multiple
        type="file"
        onChange={onChange}
      />
      <IconButton
        color="inherit"
        aria-label="upload media"
        component="span"
        onClick={resetHandler}
        size={size}
      >
        <FileUploadIcon fontSize="inherit" />
      </IconButton>
    </label>
  );
};

export default UploadButton;
