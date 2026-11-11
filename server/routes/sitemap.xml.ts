export default defineEventHandler((event) => {
  if (!isProductionHost(getRequestURL(event).hostname)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  setHeader(event, 'content-type', 'application/xml; charset=utf-8');
  return buildSitemapXml();
});
