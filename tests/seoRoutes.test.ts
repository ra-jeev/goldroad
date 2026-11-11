import { describe, expect, it } from 'vitest';
import {
  buildRobotsTxt,
  buildSitemapXml,
  isProductionHost,
} from '../server/utils/seoRoutes';

describe('seo routes', () => {
  it('recognises production hosts only', () => {
    expect(isProductionHost('playgoldroad.com')).toBe(true);
    expect(isProductionHost('www.playgoldroad.com')).toBe(true);
    expect(isProductionHost('localhost')).toBe(false);
    expect(isProductionHost('goldroad.workers.dev')).toBe(false);
  });

  it('robots allows crawling and points to the sitemap in production', () => {
    expect(buildRobotsTxt('playgoldroad.com')).toBe(
      'User-agent: *\nDisallow:\nSitemap: https://playgoldroad.com/sitemap.xml\n',
    );
  });

  it('robots blocks everything elsewhere, with no sitemap line', () => {
    const body = buildRobotsTxt('staging.workers.dev');
    expect(body).toBe('User-agent: *\nDisallow: /\n');
    expect(body).not.toContain('Sitemap');
  });

  it('sitemap lists exactly the four indexable pages', () => {
    const xml = buildSitemapXml();
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual([
      'https://playgoldroad.com/',
      'https://playgoldroad.com/about',
      'https://playgoldroad.com/games',
      'https://playgoldroad.com/how-to-play',
    ]);
    expect(xml).not.toContain('lastmod');
    expect(xml).not.toContain('/stats');
  });
});
