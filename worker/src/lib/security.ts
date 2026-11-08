/** Response headers aligned with deploy/.htaccess + Cloudflare integrations */
export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(self), camera=(self), microphone=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.clarity.ms https://challenges.cloudflare.com https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://www.google-analytics.com https://www.googletagmanager.com",
    "connect-src 'self' https://earthquake.usgs.gov https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.clarity.ms https://challenges.cloudflare.com https://cloudflareinsights.com https://*.cloudflareinsights.com",
    "font-src 'self'",
    "frame-src https://www.googletagmanager.com https://challenges.cloudflare.com",
  ].join('; '),
};

export function applySecurityHeaders(headers: Headers): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
}

export function cacheControlForPath(pathname: string): string | null {
  if (pathname.startsWith('/api/')) return null;
  if (/\.(?:js|css|woff2?|webp|png|jpe?g|svg|ico|gif)$/i.test(pathname)) {
    return 'public, max-age=31536000, immutable';
  }
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml' || pathname === '/llms.txt') {
    return 'public, max-age=86400';
  }
  if (!pathname.includes('.')) {
    return 'public, max-age=600';
  }
  return 'public, max-age=3600';
}
