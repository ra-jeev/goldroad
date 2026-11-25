// Times shown to a player are in their own time zone. The game runs on UTC
// (the road changes at 00:00 UTC), so these turn a UTC moment into local words.

/** "Sat 7:00 PM" for a UTC moment, in the player's own time. */
export function localDayTime(ms: number): string {
  const moment = new Date(ms);
  const day = moment.toLocaleDateString([], { weekday: 'short' });
  return `${day} ${moment.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}
