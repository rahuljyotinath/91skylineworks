export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const h = new Headers(headers);
  h.set('Content-Type', 'application/json; charset=utf-8');
  return Response.json(data, { status, headers: h });
}

export function sanitizeString(value: unknown, maxLen = 255): string {
  let s = String(value ?? '').trim().replace(/<[^>]*>/g, '');
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

export function clientIp(request: Request): string {
  const xff = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For');
  if (xff) return xff.split(',')[0].trim();
  return '';
}

export function analyzeImage(): {
  issueType: string;
  severity: string;
  analysis: string;
  isAmbiguous: boolean;
} {
  return {
    issueType: 'Capillary Moisture Ingress / Load-Path Interruption',
    severity: 'High',
    analysis:
      'Visual telemetry indicates active sub-surface capillary migration consistent with hydrostatic pressure breach at sub-grade plinth level. In Seismic Zone 5, combined moisture ingress and load-path interruption accelerates rebar oxidation and reduces column confinement capacity. Immediate NDT verification and PU injection grouting assessment recommended before next tectonic event cycle.',
    isAmbiguous: false,
  };
}

export const REDIRECTS: Array<{ from: RegExp; to: string }> = [
  { from: /^\/capabilities\/?$/i, to: '/services' },
  { from: /^\/process\/?$/i, to: '/' },
  { from: /^\/clients\/?$/i, to: '/portfolio' },
  { from: /^\/backing\/?$/i, to: '/about' },
  { from: /^\/telemetry\/?$/i, to: '/earthquakes' },
  { from: /^\/hydrostatic\/?$/i, to: '/knowledge' },
  { from: /^\/projects\/?$/i, to: '/portfolio' },
  { from: /^\/industries\/.*$/i, to: '/services' },
  { from: /^\/services\/industrial-flooring\/?$/i, to: '/services' },
  { from: /^\/services\/facade-restoration\/?$/i, to: '/services' },
  { from: /^\/waterproofing-experts\/?$/i, to: '/services/waterproofing' },
  { from: /^\/expansion-joint-treatment\/?$/i, to: '/services/expansion-joints' },
  { from: /^\/as\/?$/i, to: '/' },
  { from: /^\/as\/(.+)$/i, to: '/$1' },
];
