import { Hono } from 'hono';
import { api } from './routes/api';
import { internal } from './routes/internal';

export const app = new Hono();

app.route('/api', api);
app.route('/internal', internal);

app.onError((error, c) => {
  console.error(`server error: ${error.stack ?? error}`);
  return c.json({ error: 'Server error' }, 500);
});
