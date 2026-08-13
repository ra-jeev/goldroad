const LEGACY_REFRESH_URL = '/?legacy-refresh=v2';

export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'cache-control': 'no-store',
    'content-type': 'application/javascript; charset=utf-8',
    'x-content-type-options': 'nosniff',
  });

  return `window.location.replace(${JSON.stringify(LEGACY_REFRESH_URL)});`;
});
