// Times shown to a player are in their own time zone. The game runs on UTC
// (the road changes at 00:00 UTC), so these turn a UTC moment into local words.

/** "8:00 PM" for today's hh:mm UTC, in the player's own time. */
export function localTimeOfUtc(hour: number, minute = 0): string {
  const moment = new Date();
  moment.setUTCHours(hour, minute, 0, 0);
  return moment.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** "Sat 7:00 PM" for a UTC moment, in the player's own time. */
export function localDayTime(ms: number): string {
  const moment = new Date(ms);
  const day = moment.toLocaleDateString([], { weekday: 'short' });
  return `${day} ${moment.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}
