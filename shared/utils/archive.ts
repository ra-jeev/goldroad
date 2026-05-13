export const RECENT_ARCHIVE_DAY_LIMIT = 30;

export function hasDeepArchiveRoads(
  currentGameNo: number | null | undefined,
): currentGameNo is number {
  return (
    typeof currentGameNo === 'number' &&
    currentGameNo > RECENT_ARCHIVE_DAY_LIMIT + 1
  );
}

export function getDeepArchiveCutoffGameNo(currentGameNo: number): number {
  return currentGameNo - RECENT_ARCHIVE_DAY_LIMIT;
}
