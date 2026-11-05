import type { IncomingMessage, ServerResponse } from 'http';

// fake js.map to prevent warnings
const middleware = (req: IncomingMessage, res: ServerResponse, next: (err?: Error) => void) => {
  if (req.method === 'GET' && req.url?.endsWith('.js.map')) {
    res.setHeader('Content-Type', 'application/json').end(
      JSON.stringify({
        version: 3,
        file: '',
        sourceRoot: '',
        sources: [],
        names: [],
        mappings: '',
      }),
    );
  } else {
    next();
  }
};

export default middleware;
