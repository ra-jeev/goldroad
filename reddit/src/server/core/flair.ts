import { context, reddit, redis } from '@devvit/web/server';
import { remember } from './userIndex';

/** The last flair text this app gave a user, so it never replaces their own. */
const userFlairKey = (userId: string) => `flair:${userId}`;
const dailyTemplateKey = 'flair:post:daily';

// "road" is the old word, kept so the app still updates those flairs.
const STREAK_FLAIR = /^🔥 \d+-day (streak|road)( · best \d+)?$/u;

export function streakFlairText(streak: number, best: number): string {
  const text = `🔥 ${streak}-day streak`;
  return best > streak ? `${text} · best ${best}` : text;
}

/**
 * Show the player's streak as their flair in the subreddit. A flair the
 * player or a moderator chose is kept: the app only writes over an empty
 * flair or one it wrote itself. A failure never stops the solve.
 */
export async function updateStreakFlair(userId: string, username: string, streak: number, best: number) {
  const text = streakFlairText(streak, best);
  try {
    const subredditName = context.subredditName;
    const user = await reddit.getUserByUsername(username);
    const current = (await user?.getUserFlairBySubreddit(subredditName))?.flairText?.trim() ?? '';
    const ours = await redis.get(userFlairKey(userId));
    if (current && current !== ours && !STREAK_FLAIR.test(current)) return;
    if (current === text) return;
    await reddit.setUserFlair({ subredditName, username, text, backgroundColor: '#1d1708', textColor: 'light' });
    await redis.set(userFlairKey(userId), text);
    await remember(userId, userFlairKey(userId));
  } catch (error) {
    console.error(`could not set streak flair: ${error}`);
  }
}

type PostFlair = { text: string; modOnly: boolean; backgroundColor: string; textColor: 'dark' | 'light' };

export const POST_FLAIRS: PostFlair[] = [
  { text: 'Daily road', modOnly: true, backgroundColor: '#e8b931', textColor: 'dark' },
  { text: 'Feedback', modOnly: false, backgroundColor: '#3b6ea5', textColor: 'light' },
  { text: 'Bug', modOnly: false, backgroundColor: '#b5462f', textColor: 'light' },
];

/**
 * Make the post flairs the subreddit needs, once. Safe to call again: a
 * flair with the same text is kept. Returns the "Daily road" template id.
 */
export async function ensurePostFlairs(): Promise<string> {
  const subredditName = context.subredditName;
  const existing = await reddit.getPostFlairTemplates(subredditName);
  let dailyId = '';
  for (const flair of POST_FLAIRS) {
    const found = existing.find((template) => template.text === flair.text);
    const id = found ? found.id : (await reddit.createPostFlairTemplate({ subredditName, ...flair })).id;
    if (flair.text === 'Daily road') dailyId = id;
  }
  await redis.set(dailyTemplateKey, dailyId);
  return dailyId;
}

/** Put the "Daily road" flair on a new daily post. */
export async function flairDailyPost(postId: `t3_${string}`): Promise<void> {
  const subredditName = context.subredditName;
  const cached = await redis.get(dailyTemplateKey);
  try {
    await reddit.setPostFlair({ subredditName, postId, flairTemplateId: cached || (await ensurePostFlairs()) });
  } catch (error) {
    if (!cached) throw error;
    // A moderator may have deleted the template. Make it again, once.
    await reddit.setPostFlair({ subredditName, postId, flairTemplateId: await ensurePostFlairs() });
  }
}
