import { createApp } from './http/server.js';

const port = Number(process.env.PORT ?? 3000);
createApp().listen(port, '0.0.0.0', () => console.log('Listening on', port));
