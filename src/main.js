import { createApp } from './http/server.js';
import { createMemoryStore } from './stores/memory.js';
import { memoryFixtures } from './stores/memory-fixtures.js';

const port = Number(process.env.PORT ?? 3000);
const store = createMemoryStore(memoryFixtures(Date.now()));
createApp({ store }).listen(port, '0.0.0.0', () =>
  console.log('Listening on', port),
);
