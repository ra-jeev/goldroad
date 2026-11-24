import { pruneExpiredAnalytics } from '../utils/analyticsRetention';
import { createGoldroadDb } from '../utils/roadOperations';

type CloudflareTaskContext = {
  cloudflare?: {
    env?: {
      DB?: D1Database;
    };
  };
};

export default defineTask({
  meta: {
    name: 'prune-analytics',
    description: 'Delete play stats that are older than the retention period.',
  },
  async run({ context }) {
    const d1 = (context as CloudflareTaskContext).cloudflare?.env?.DB;

    if (!d1) {
      throw new Error(
        'D1 binding "DB" not found for prune-analytics task. Check wrangler.jsonc and Nitro Cloudflare context.',
      );
    }

    const result = await pruneExpiredAnalytics(createGoldroadDb(d1));
    console.log('[analytics-retention] completed', result);

    return { result };
  },
});
