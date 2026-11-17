import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { app } from './app';

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
