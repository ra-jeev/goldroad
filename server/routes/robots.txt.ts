export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'text/plain; charset=utf-8');

  const hostname = getRequestURL(event).hostname;
  const isProductionHost = [
    'playgoldroad.com',
    'www.playgoldroad.com',
  ].includes(hostname);

  return isProductionHost
    ? 'User-agent: *\nDisallow:\n'
    : 'User-agent: *\nDisallow: /\n';
});
