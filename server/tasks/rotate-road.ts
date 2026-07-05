import {
  createGoldroadDb,
  rotateRoadAndReplenishPool,
} from '../utils/roadOperations';

type CloudflareTaskContext = {
  cloudflare?: {
    env?: {
      DB?: D1Database;
    };
  };
};

export default defineTask({
  meta: {
    name: 'rotate-road',
    description: 'Rotate the current road day and replenish future puzzles.',
  },
  async run({ context }) {
    const d1 = (context as CloudflareTaskContext).cloudflare?.env?.DB;

    if (!d1) {
      throw new Error(
        'D1 binding "DB" not found for rotate-road task. Check wrangler.jsonc and Nitro Cloudflare context.',
      );
    }

    const result = await rotateRoadAndReplenishPool(createGoldroadDb(d1));
    console.log('[road-rotation] completed', result);

    return { result };
  },
});
