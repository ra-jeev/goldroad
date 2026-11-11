const PRODUCTION_HOSTS = ['playgoldroad.com', 'www.playgoldroad.com'];

export const SITEMAP_URL = 'https://playgoldroad.com/sitemap.xml';

const SITEMAP_PATHS = ['/', '/about', '/games', '/how-to-play'];

export function isProductionHost(hostname: string): boolean {
  return PRODUCTION_HOSTS.includes(hostname);
}

export function buildRobotsTxt(hostname: string): string {
  return isProductionHost(hostname)
    ? `User-agent: *\nDisallow:\nSitemap: ${SITEMAP_URL}\n`
    : 'User-agent: *\nDisallow: /\n';
}

export function buildSitemapXml(): string {
  const urls = SITEMAP_PATHS.map(
    (path) => `  <url><loc>https://playgoldroad.com${path}</loc></url>`,
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
