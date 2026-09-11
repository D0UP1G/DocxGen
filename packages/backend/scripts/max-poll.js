import { env } from '../src/config/env.js';
import { createMaxClient } from '../src/adapters/max/client.js';
import { createMaxPoller } from '../src/adapters/max/poller.js';
import { trustExtraCa } from '../src/config/extraCa.js';
trustExtraCa(env.MAX_CA_FILE); const client = createMaxClient({ baseUrl: env.MAX_API_URL, token: env.MAX_TOKEN });
console.log('MAX polling запущен. Сырые события будут выведены ниже.');
await createMaxPoller({ client, onEvent: async (event) => console.log(JSON.stringify(event)), log: console }).start();
