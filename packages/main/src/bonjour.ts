import { app } from 'electron';

import bonjourHap from 'bonjour-hap';

const bonjour = bonjourHap();

app.once('will-quit', () => bonjour.destroy());

export default bonjour;
