import { ipcRenderer } from 'electron';
import ipcDispatch from '../common/ipcDispatch';
import { brightnessDown, brightnessUp } from '/@renderer/store/configSlice';

ipcRenderer.on('brightnessUp', () => {
  ipcDispatch(brightnessUp());
});

ipcRenderer.on('brightnessDown', () => {
  ipcDispatch(brightnessDown());
});
