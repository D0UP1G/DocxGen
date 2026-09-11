import { env } from '../src/config/env.js';
import { createVkClient } from '../src/adapters/vk/client.js';
import { createVkLongPoller } from '../src/adapters/vk/longpoll.js';
 const client = createVkClient({ token: env.VK_TOKEN, apiVersion: env.VK_API_VERSION });
console.log('VK Long Poll запущен. Сырые события будут выведены ниже.');
await createVkLongPoller({ client, groupId: env.VK_GROUP_ID, onEvent: async (event) => console.log(JSON.stringify(event)), log: console }).start();
