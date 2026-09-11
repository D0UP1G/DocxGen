import { env } from '../src/config/env.js';
import { createMaxClient } from '../src/adapters/max/client.js';

import { trustExtraCa } from '../src/config/extraCa.js';
trustExtraCa(env.MAX_CA_FILE); const client = createMaxClient({ baseUrl: env.MAX_API_URL, token: env.MAX_TOKEN }); const args = new Set(process.argv.slice(2));
if (args.has('--me')) console.log(JSON.stringify(await client.me(), null, 2));
else if (args.has('--list')) console.log(JSON.stringify(await client.listSubscriptions(), null, 2));
else if (args.has('--delete')) console.log(JSON.stringify(await client.unsubscribe(`${env.PUBLIC_URL.replace(/\/$/, '')}/integrations/max/webhook`), null, 2));
else console.log(JSON.stringify(await client.subscribe({ url: `${env.PUBLIC_URL.replace(/\/$/, '')}/integrations/max/webhook`, secret: env.MAX_WEBHOOK_SECRET, updateTypes: ['bot_started', 'message_created', 'message_callback'] }), null, 2));
