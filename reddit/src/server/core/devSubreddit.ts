import { context } from '@devvit/web/server';

/**
 * The private dev subreddit. Test tools live only here, and so do features
 * Reddit has not opened to this app yet (push notifications are a gated beta).
 */
export const DEV_SUBREDDIT = 'goldroad_daily_dev';

export const isDevSubreddit = (): boolean => context.subredditName === DEV_SUBREDDIT;
