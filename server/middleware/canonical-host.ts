export default defineEventHandler((event) => {
  const requestUrl = getRequestURL(event);

  if (requestUrl.hostname !== 'www.playgoldroad.com') return;

  return sendRedirect(
    event,
    `https://playgoldroad.com${requestUrl.pathname}${requestUrl.search}`,
    301,
  );
});
