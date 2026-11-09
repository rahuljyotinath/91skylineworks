#!/usr/bin/env node
/**
 * Generates robots.txt, sitemap.xml, llms.txt, static route HTML, and injects SEO into dist/index.html
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchNeEarthquakes, formatEventTime } from './lib/fetch-earthquakes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const contentPath = path.join(root, 'backend/src/seed/content.json');
const contentAsPath = path.join(root, 'backend/src/seed/content.as.json');
const distDir = path.join(root, 'frontend/dist');
const siteUrl = 'https://91skylineworks.com';
const ogImage = `${siteUrl}/images/logo.png`;

const contentEn = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
const assameseEnabled = process.env.ASSAMESE_ENABLED === '1' || process.env.ASSAMESE_ENABLED === 'true';
const contentAs = assameseEnabled && fs.existsSync(contentAsPath)
  ? JSON.parse(fs.readFileSync(contentAsPath, 'utf8'))
  : null;

let content = contentEn;
let activeLocale = 'en';
let routePrefix = '';

function buildRoutesFromContent(source) {
  const serviceCategoryRoutes = (source.serviceCategories || []).map(
    (c) => `/services/category/${c.slug}`,
  );
  return [
    '/',
    '/problems',
    ...(source.problems || []).map((p) => `/problems/${p.slug}`),
    '/knowledge',
    ...(source.knowledgeArticles || []).map((a) => `/knowledge/${a.slug}`),
    '/services',
    ...serviceCategoryRoutes,
    ...(source.servicePages || []).map((p) => `/services/${p.slug}`),
    '/portfolio',
    ...(source.projects || []).map((p) => `/portfolio/${p.slug}`),
    ...(source.localLandings || []).map((l) => `/guwahati/${l.slug}`),
    '/about',
    '/earthquakes',
    '/education',
    '/analyzer',
    '/assessment',
    '/contact',
  ];
}

const ROUTES = buildRoutesFromContent(contentEn);

const SITEMAP_EXCLUDED = new Set(['/analyzer', '/assessment']);
const SITEMAP_ROUTES = ROUTES.filter((route) => !SITEMAP_EXCLUDED.has(route));

/** @type {{ events: object[], fetchedAt: number, source: string } | null} */
let earthquakeSnapshot = null;

function setActiveLocale(locale) {
  activeLocale = locale;
  routePrefix = locale === 'as' ? '/as' : '';
  content = locale === 'as' && contentAs ? contentAs : contentEn;
}

function publicRoute(route) {
  if (!routePrefix) return route;
  if (route === '/') return '/as';
  return `${routePrefix}${route}`;
}

function localizedHref(route) {
  return publicRoute(route);
}

function buildStaticRelatedLinks({ services = [], problems = [], projectSlug, title = 'Related' }) {
  const serviceList = services
    .map((slug) => content.services?.find((s) => s.slug === slug))
    .filter(Boolean);
  const problemList = problems
    .map((slug) => content.problems?.find((p) => p.slug === slug))
    .filter(Boolean);
  const project = projectSlug
    ? content.projects?.find((p) => p.slug === projectSlug)
    : null;

  if (!serviceList.length && !problemList.length && !project) return '';

  let html = `<aside class="static-related"><h2>${escapeHtml(title)}</h2>`;
  if (serviceList.length) {
    html += `<h3>Services</h3><ul>${serviceList.map((s) => `<li><a href="${localizedHref(`/services/${s.slug}`)}">${escapeHtml(s.title)}</a></li>`).join('')}</ul>`;
  }
  if (problemList.length) {
    html += `<h3>Problems</h3><ul>${problemList.map((p) => `<li><a href="${localizedHref(`/problems/${p.slug}`)}">${escapeHtml(p.title)}</a></li>`).join('')}</ul>`;
  }
  if (project) {
    html += `<h3>Case study</h3><p><a href="${localizedHref(`/portfolio/${project.slug}`)}">${escapeHtml(project.title)}</a> — ${escapeHtml(project.scope)}</p>`;
  }
  return `${html}</aside>`;
}

function buildStaticBreadcrumb(route) {
  const prob = (content.problems || []).find((p) => route === `/problems/${p.slug}`);
  if (prob) {
    return `<nav aria-label="Breadcrumb"><a href="${localizedHref('/problems')}">Problems</a> / ${escapeHtml(prob.title)}</nav>`;
  }
  const art = (content.knowledgeArticles || []).find((a) => route === `/knowledge/${a.slug}`);
  if (art) {
    return `<nav aria-label="Breadcrumb"><a href="${localizedHref('/knowledge')}">Knowledge</a> / ${escapeHtml(art.title)}</nav>`;
  }
  const sp = (content.servicePages || []).find((p) => route === `/services/${p.slug}`);
  if (sp) {
    return `<nav aria-label="Breadcrumb"><a href="${localizedHref('/services')}">Services</a> / ${escapeHtml(sp.title)}</nav>`;
  }
  const serviceCategory = (content.serviceCategories || []).find(
    (c) => route === `/services/category/${c.slug}`,
  );
  if (serviceCategory) {
    return `<nav aria-label="Breadcrumb"><a href="${localizedHref('/services')}">Services</a> / ${escapeHtml(serviceCategory.label)}</nav>`;
  }
  const proj = (content.projects || []).find((p) => route === `/portfolio/${p.slug}`);
  if (proj) {
    return `<nav aria-label="Breadcrumb"><a href="${localizedHref('/portfolio')}">Portfolio</a> / ${escapeHtml(proj.title)}</nav>`;
  }
  const landing = (content.localLandings || []).find((l) => route === `/guwahati/${l.slug}`);
  if (landing) {
    return `<nav aria-label="Breadcrumb"><a href="${localizedHref('/')}">Home</a> / ${escapeHtml(landing.headline)}</nav>`;
  }
  return '';
}

function buildStaticFooterNav() {
  const localLinks = (content.localLandings || [])
    .map(
      (l) =>
        `<li><a href="${localizedHref(`/guwahati/${l.slug}`)}">${escapeHtml(l.headline.split('—')[0].trim() || l.headline)}</a></li>`,
    )
    .join('');
  return `<nav aria-label="Site sections" class="static-site-nav">
      <h2>Explore 91SkylineWorks</h2>
      <ul>
        <li><a href="${localizedHref('/')}">Home</a></li>
        <li><a href="${localizedHref('/problems')}">Building problems</a></li>
        <li><a href="${localizedHref('/knowledge')}">Knowledge Centre</a></li>
        <li><a href="${localizedHref('/services')}">Services</a></li>
        <li><a href="${localizedHref('/portfolio')}">Portfolio</a></li>
        ${localLinks}
        <li><a href="${localizedHref('/guwahati/waterproofing')}">Waterproofing in Guwahati</a></li>
        <li><a href="${localizedHref('/guwahati/building-crack-repair')}">Building crack repair</a></li>
        <li><a href="${localizedHref('/earthquakes')}">Earthquakes near Guwahati</a></li>
        <li><a href="${localizedHref('/education')}">Education</a></li>
        <li><a href="${localizedHref('/about')}">About</a></li>
        <li><a href="${localizedHref('/contact')}">Contact</a></li>
      </ul>
    </nav>`;
}

function relatedProblemsForService(serviceSlug, limit = 3) {
  return (content.problems || [])
    .filter((p) => (p.linkedServices || []).includes(serviceSlug))
    .slice(0, limit);
}

function relatedKnowledgeArticles(article, limit = 3) {
  if (!article?.cluster) return [];
  return (content.knowledgeArticles || [])
    .filter((a) => a.slug !== article.slug && a.cluster === article.cluster)
    .slice(0, limit);
}

function sitemapMeta(route) {
  if (route === '/') return { priority: '1.0', changefreq: 'weekly' };
  if (route === '/earthquakes') return { priority: '0.9', changefreq: 'hourly' };
  if (route.startsWith('/guwahati/')) return { priority: '0.9', changefreq: 'weekly' };
  if (['/problems', '/knowledge', '/services', '/portfolio', '/contact', '/about'].includes(route)) {
    return { priority: '0.9', changefreq: 'weekly' };
  }
  if (
    ['/services/waterproofing', '/services/retrofitting', '/services/ndt', '/services/seismic-jacketing'].includes(
      route,
    )
  ) {
    return { priority: '0.9', changefreq: 'weekly' };
  }
  if (route === '/education') return { priority: '0.5', changefreq: 'monthly' };
  if (
    route.startsWith('/problems/') ||
    route.startsWith('/knowledge/') ||
    route.startsWith('/portfolio/') ||
    route.startsWith('/services/')
  ) {
    return { priority: '0.7', changefreq: 'monthly' };
  }
  return { priority: '0.7', changefreq: 'monthly' };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statLabel(stat) {
  return `${stat.value}${stat.suffix} ${stat.label}`;
}

function buildEarthquakeEventsHtml(events, { limit = 15, heading = 'Recent earthquakes near Guwahati & Northeast India' } = {}) {
  if (!events?.length) {
    return `<h2>${escapeHtml(heading)}</h2><p>No recent USGS events in the last 7 days for Northeast India.</p>`;
  }

  const rows = events.slice(0, limit).map((event) => {
    const mag = event.mag != null ? `M${Number(event.mag).toFixed(1)}` : '—';
    const depth = event.depth != null ? `${Math.round(event.depth)} km deep` : '';
    const when = formatEventTime(event.time);
    const link = event.url
      ? ` <a href="${escapeHtml(event.url)}" rel="noopener noreferrer">USGS details</a>`
      : '';
    return `<li><strong>${escapeHtml(mag)}</strong> — ${escapeHtml(event.place)} — ${escapeHtml(when)}${depth ? ` — ${escapeHtml(depth)}` : ''}${link}</li>`;
  });

  return `<h2>${escapeHtml(heading)}</h2><ol>${rows.join('')}</ol>`;
}

function buildEarthquakeFaqHtml() {
  const faqs = content.earthquakes?.faq || [];
  if (!faqs.length) return '';
  return `<h2>Frequently asked questions</h2>${faqs.map((f) => `<h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p>`).join('')}`;
}

function buildHomeEarthquakeSection() {
  const eq = content.earthquakes || {};
  const hs = content.homeSections?.earthquakes || {};
  const events = earthquakeSnapshot?.events || [];
  const eventsHtml = buildEarthquakeEventsHtml(events, { limit: 5, heading: 'Latest tremors near Guwahati' });

  return `<h2>${escapeHtml(hs.headline || eq.headline || 'Recent earthquakes near Guwahati')}</h2>
      <p>${escapeHtml(eq.homeIntro || eq.subhead || '')}</p>
      ${eventsHtml}
      <p><a href="${localizedHref('/earthquakes')}">View live earthquake map near Guwahati →</a></p>`;
}

function buildPageTitle(headline, seoTitle) {
  const TITLE_MAX = 60;
  const BRAND_SUFFIX = ' | 91SkylineWorks';
  const base = seoTitle || headline;
  const full = base + BRAND_SUFFIX;
  if (full.length <= TITLE_MAX) return full;
  const trimAt = TITLE_MAX - BRAND_SUFFIX.length - 1;
  return `${base.slice(0, trimAt).trim()}…${BRAND_SUFFIX}`;
}

function routeMeta(route) {
  const base = content.meta;
  const problem = (content.problems || []).find((p) => route === `/problems/${p.slug}`);
  if (problem) {
    return {
      title: buildPageTitle(problem.title, problem.seoTitle),
      description: problem.intro.slice(0, 160),
    };
  }
  const article = (content.knowledgeArticles || []).find((a) => route === `/knowledge/${a.slug}`);
  if (article) {
    return {
      title: buildPageTitle(article.title, article.seoTitle),
      description: article.excerpt.slice(0, 160),
    };
  }
  const servicePage = (content.servicePages || []).find((p) => route === `/services/${p.slug}`);
  if (servicePage) {
    return {
      title: buildPageTitle(servicePage.title, servicePage.seoTitle),
      description: servicePage.intro.slice(0, 160),
    };
  }
  const serviceCategory = (content.serviceCategories || []).find(
    (c) => route === `/services/category/${c.slug}`,
  );
  if (serviceCategory) {
    return {
      title: buildPageTitle(`${serviceCategory.label} services in Guwahati`, serviceCategory.seoTitle),
      description: serviceCategory.intro.slice(0, 160),
    };
  }
  const localLanding = (content.localLandings || []).find((l) => route === `/guwahati/${l.slug}`);
  if (localLanding) {
    return {
      title: buildPageTitle(localLanding.headline, localLanding.seoTitle),
      description: localLanding.intro.slice(0, 160),
    };
  }
  const map = {
    '/': { title: base.title, description: base.description },
    '/problems': {
      title: 'Building Problems — Leaks, Cracks & Damp | Guwahati',
      description: 'Diagnose basement leaks, terrace leakage, column cracks, damp walls and more. Problem-first guides for Guwahati building owners.',
    },
    '/knowledge': {
      title: 'Knowledge Centre — Building Engineering Guides',
      description: 'Articles on waterproofing, retrofitting, PU injection, NDT, monsoon maintenance and structural repair in Guwahati.',
    },
    '/services': {
      title: 'Services — Retrofitting, Waterproofing, NDT & More',
      description: content.services.map((s) => s.title).join(', ') + '. Guwahati & Northeast India.',
    },
    '/portfolio': {
      title: 'Portfolio — Structural Remediation Projects',
      description: content.projects.map((p) => p.title).join(', ') + '.',
    },
    '/about': {
      title: 'About — ' + content.about.headline,
      description: content.about.body[0],
    },
    '/earthquakes': {
      title: content.earthquakes?.seoTitle || 'Earthquakes Near Guwahati Today — Live Map | Northeast India',
      description:
        content.earthquakes?.seoDescription ||
        `Live earthquake map for Guwahati, Assam and Northeast India. ${content.earthquakes?.subhead || ''}`.slice(0, 160),
    },
    '/education': {
      title: 'Education — Forensic Structural Engineering',
      description: content.education.sections[0].body.slice(0, 200) + '…',
    },
    '/analyzer': {
      title: 'Analyzer — Structural Camera Scan',
      description: content.hero.primaryCta.label + '. NDT diagnostics for Seismic Zone 5 structures.',
    },
    '/assessment': {
      title: 'Assessment — Self-Diagnostic Quiz',
      description: 'Structural self-assessment quiz for property owners in Northeast India.',
    },
    '/contact': {
      title: 'Contact — ' + content.contact.headline,
      description: `${content.contact.phone} · ${content.contact.email} · ${content.contact.address}`,
    },
  };
  return map[route] || { title: base.title, description: base.description };
}

function buildRouteBody(route) {
  switch (route) {
    case '/':
      return buildHomeBody();
    case '/services':
      return `<h1>Services</h1><ul>${content.services.map((s) => `<li><a href="${localizedHref(`/services/${s.slug}`)}"><strong>${escapeHtml(s.title)}</strong></a> — ${escapeHtml(s.description)}</li>`).join('')}</ul>`;
    case '/portfolio':
      return `<h1>Portfolio</h1>${content.projects.map((p) => `<h2>${escapeHtml(p.title)}</h2><p>${escapeHtml(p.category)} · ${escapeHtml(p.location)} · ${p.year}</p><p>${escapeHtml(p.scope)}</p>`).join('')}<h2>${escapeHtml(content.homeSections?.clients?.headline || 'Clients')}</h2><ul>${content.clients.map((c) => `<li>${escapeHtml(c.name)} — ${escapeHtml(c.location)}</li>`).join('')}</ul>`;
    case '/about':
      return `<h1>${escapeHtml(content.about.headline)}</h1>${content.about.body.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}<ul>${content.about.points.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul><h2>${escapeHtml(content.homeSections?.backing?.headline || 'Our Backing')}</h2>${content.backing.map((b) => `<h3>${escapeHtml(b.title)}</h3><p>${escapeHtml(b.body)}</p>`).join('')}`;
    case '/earthquakes': {
      const eq = content.earthquakes || {};
      const events = earthquakeSnapshot?.events || [];
      const eventsHtml = buildEarthquakeEventsHtml(events);
      const fetchedNote = earthquakeSnapshot
        ? `<p><em>USGS data pre-rendered ${escapeHtml(formatEventTime(earthquakeSnapshot.fetchedAt))}.</em></p>`
        : '';
      return `<h1>${escapeHtml(eq.headline || 'Earthquakes near Guwahati today')}</h1>
      <p>${escapeHtml(eq.bridgeNote || eq.subhead || '')}</p>
      <p>${escapeHtml(eq.subhead || '')}</p>
      ${eventsHtml}
      ${fetchedNote}
      <h2>Regional seismic monitoring</h2>
      <p>Station: ${escapeHtml(content.telemetry.station)} · ${escapeHtml(content.telemetry.alertStatus)}</p>
      <p>${escapeHtml(content.telemetry.engineNote)}</p>
      <p>${escapeHtml(eq.disclaimer || '')}</p>
      <p><a href="${localizedHref('/services/seismic-jacketing')}">Seismic retrofitting for Zone V buildings →</a> · <a href="${localizedHref('/knowledge/seismic-zone-5-guwahati-homeowner')}">Zone V homeowner guide →</a></p>
      ${buildEarthquakeFaqHtml()}`;
    }
    case '/education':
      return `<h1>Forensic Engineering Education</h1>${content.education.sections.map((s) => `<h2>${escapeHtml(s.title)}</h2>${s.body ? `<p>${escapeHtml(s.body)}</p>` : ''}${s.stages ? `<ul>${s.stages.map((st) => `<li><strong>${escapeHtml(st.label)}</strong> ${escapeHtml(st.text)}</li>`).join('')}</ul>` : ''}`).join('')}<h2>${escapeHtml(content.advisory.title)}</h2>${content.advisory.points.map((p) => `<h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.body)}</p>`).join('')}`;
    case '/analyzer':
      return `<h1>Structural Camera Scan</h1><p>${escapeHtml(content.hero.subheadline)}</p><p>Use the interactive analyzer to capture structural images for NDT assessment.</p>`;
    case '/assessment':
      return `<h1>Self-Diagnostic Assessment</h1><p>Answer structural risk questions to receive a preliminary vulnerability profile for your building.</p>`;
    case '/contact':
      return `<h1>${escapeHtml(content.contact.headline)}</h1><p>${escapeHtml(content.contact.body)}</p><p>Phone: ${escapeHtml(content.contact.phone)}</p><p>Email: ${escapeHtml(content.contact.email)}</p><p>Address: ${escapeHtml(content.contact.address)}</p><p>Hours: ${escapeHtml(content.contact.hours)}</p>`;
    case '/problems':
      return `<h1>Building Problems</h1><p>Diagnose leaks, cracks, dampness and structural issues in Guwahati buildings.</p><ul>${(content.problems || []).map((p) => `<li><a href="${localizedHref(`/problems/${p.slug}`)}"><strong>${escapeHtml(p.title)}</strong></a> — ${escapeHtml(p.headline)}</li>`).join('')}</ul>`;
    case '/knowledge':
      return `<h1>Knowledge Centre</h1><ul>${(content.knowledgeArticles || []).map((a) => `<li><a href="${localizedHref(`/knowledge/${a.slug}`)}"><strong>${escapeHtml(a.title)}</strong></a> — ${escapeHtml(a.excerpt)}</li>`).join('')}</ul>`;
    default: {
      const prob = (content.problems || []).find((p) => route === `/problems/${p.slug}`);
      if (prob) {
        const faqs = (prob.faqs || []).map((f) => `<h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p>`).join('');
        const related = buildStaticRelatedLinks({
          services: prob.linkedServices,
          projectSlug: prob.linkedProject,
          title: 'Recommended next steps',
        });
        return `${buildStaticBreadcrumb(route)}<h1>${escapeHtml(prob.headline)}</h1><p>${escapeHtml(prob.intro)}</p><h2>Symptoms</h2><ul>${prob.symptoms.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul><h2>Diagnosis</h2><p>${escapeHtml(prob.diagnosis)}</p>${faqs}${related}`;
      }
      const art = (content.knowledgeArticles || []).find((a) => route === `/knowledge/${a.slug}`);
      if (art) {
        const relatedArticles = relatedKnowledgeArticles(art);
        const relatedHtml = relatedArticles.length
          ? `<aside class="static-related"><h2>Related articles</h2><ul>${relatedArticles.map((r) => `<li><a href="${localizedHref(`/knowledge/${r.slug}`)}">${escapeHtml(r.title)}</a></li>`).join('')}</ul></aside>`
          : '';
        return `${buildStaticBreadcrumb(route)}<h1>${escapeHtml(art.title)}</h1><p>${escapeHtml(art.excerpt)}</p><p>${escapeHtml(art.body)}</p>${relatedHtml}`;
      }
      const serviceCategory = (content.serviceCategories || []).find(
        (c) => route === `/services/category/${c.slug}`,
      );
      if (serviceCategory) {
        const items = (content.services || []).filter((s) => s.category === serviceCategory.slug);
        return `<h1>${escapeHtml(serviceCategory.headline)}</h1><p>${escapeHtml(serviceCategory.intro)}</p><ul>${items.map((s) => `<li><a href="${localizedHref(`/services/${s.slug}`)}"><strong>${escapeHtml(s.title)}</strong></a> — ${escapeHtml(s.description)}</li>`).join('')}</ul>`;
      }
      const proj = (content.projects || []).find((p) => route === `/portfolio/${p.slug}`);
      if (proj) {
        const body = proj.body ? `<p>${escapeHtml(proj.body.replace(/\n\n/g, ' '))}</p>` : '';
        const serviceLinks = (proj.services || [])
          .map((slug) => {
            const svc = (content.services || []).find((s) => s.slug === slug);
            return svc ? `<li><a href="${localizedHref(`/services/${slug}`)}">${escapeHtml(svc.title)}</a></li>` : '';
          })
          .filter(Boolean)
          .join('');
        const servicesHtml = serviceLinks
          ? `<h2>Services used</h2><ul>${serviceLinks}</ul>`
          : '';
        return `${buildStaticBreadcrumb(route)}<h1>${escapeHtml(proj.title)}</h1><p>${escapeHtml(proj.scope || '')}</p>${body}<p><strong>Outcome:</strong> ${escapeHtml(proj.outcome || '')}</p>${servicesHtml}`;
      }
      const sp = (content.servicePages || []).find((p) => route === `/services/${p.slug}`);
      if (sp) {
        const h1 = sp.seoHeadline || sp.headline;
        const awareness = sp.awareness
          ? `<h2>${escapeHtml(sp.awareness.headline)}</h2><p>${escapeHtml(sp.awareness.body)}</p>`
          : '';
        const offerings = (sp.offerings || [])
          .map(
            (o) =>
              `<h3>${escapeHtml(o.name)}</h3><p>${escapeHtml(o.description)}</p>${o.whenUsed ? `<p><strong>When:</strong> ${escapeHtml(o.whenUsed)}</p>` : ''}${o.whyItMatters ? `<p><strong>Risk:</strong> ${escapeHtml(o.whyItMatters)}</p>` : ''}`,
          )
          .join('');
        const sections = (sp.sections || [])
          .map(
            (sec) =>
              `<h2>${escapeHtml(sec.title)}</h2>${sec.body ? `<p>${escapeHtml(sec.body)}</p>` : ''}${sec.bullets ? `<ul>${sec.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : ''}`,
          )
          .join('');
        const svc = (content.services || []).find((s) => s.slug === sp.slug);
        const categoryLink = svc?.category
          ? `<p><a href="${localizedHref(`/services/category/${svc.category}`)}">More ${escapeHtml(svc.category)} services →</a></p>`
          : '';
        const relatedProblems = relatedProblemsForService(sp.slug);
        const relatedProblemsHtml = relatedProblems.length
          ? `<aside class="static-related"><h2>Common problems we fix</h2><ul>${relatedProblems.map((p) => `<li><a href="${localizedHref(`/problems/${p.slug}`)}">${escapeHtml(p.title)}</a></li>`).join('')}</ul></aside>`
          : '';
        return `${buildStaticBreadcrumb(route)}<h1>${escapeHtml(h1)}</h1><p>${escapeHtml(sp.intro)}</p>${categoryLink}${awareness}${offerings ? `<h2>Services</h2>${offerings}` : ''}${sections}${sp.ctaMessage ? `<p>${escapeHtml(sp.ctaMessage)}</p>` : ''}${relatedProblemsHtml}`;
      }
      const landing = (content.localLandings || []).find((l) => route === `/guwahati/${l.slug}`);
      if (landing) {
        const sections = (landing.sections || [])
          .map((sec) => `<h2>${escapeHtml(sec.title)}</h2><p>${escapeHtml(sec.body)}</p>`)
          .join('');
        const faqs = (landing.faqs || [])
          .map((f) => `<h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p>`)
          .join('');
        const serviceLinks = (landing.linkedServices || [])
          .map((slug) => {
            const svc = (content.services || []).find((s) => s.slug === slug);
            return svc ? `<li><a href="${localizedHref(`/services/${slug}`)}">${escapeHtml(svc.title)}</a></li>` : '';
          })
          .join('');
        const problemLinks = (landing.linkedProblems || [])
          .map((slug) => {
            const prob = (content.problems || []).find((p) => p.slug === slug);
            return prob ? `<li><a href="${localizedHref(`/problems/${slug}`)}">${escapeHtml(prob.title)}</a></li>` : '';
          })
          .join('');
        return `<h1>${escapeHtml(landing.headline)}</h1><p>${escapeHtml(landing.intro)}</p>${sections}${serviceLinks ? `<h2>Related services</h2><ul>${serviceLinks}</ul>` : ''}${problemLinks ? `<h2>Common problems</h2><ul>${problemLinks}</ul>` : ''}${faqs ? `<h2>FAQ</h2>${faqs}` : ''}${landing.ctaMessage ? `<p>${escapeHtml(landing.ctaMessage)}</p>` : ''}`;
      }
      return buildHomeBody();
    }
  }
}

function buildHomeBody() {
  const stats = content.stats.map((s) => `<li>${escapeHtml(statLabel(s))}</li>`).join('');
  const services = (content.services || [])
    .map((s) => `<li><strong>${escapeHtml(s.title)}</strong> — ${escapeHtml(s.description)}</li>`)
    .join('');
  const clients = content.clients
    .map((c) => `<li>${escapeHtml(c.name)} (${escapeHtml(c.location)})</li>`)
    .join('');
  const faq = (content.homeownerFaq?.items || [])
    .map((f) => `<h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p>`)
    .join('');

  return `<h2>${escapeHtml(content.company.fullName)} — Building Doctor, Guwahati</h2>
      <p>${escapeHtml(content.meta.description)}</p>
      ${buildHomeEarthquakeSection()}
      <h2>Stats</h2>
      <ul>${stats}</ul>
      <h2>Services</h2>
      <ul>${services}</ul>
      <h2>Clients</h2>
      <ul>${clients}</ul>
      ${faq ? `<h2>FAQ</h2>${faq}` : ''}
      <h2>Contact</h2>
      <p>Phone: ${escapeHtml(content.contact.phone)} · Email: ${escapeHtml(content.contact.email)} · ${escapeHtml(content.contact.address)}</p>`;
}

function parseOpeningHours(hoursStr) {
  if (!hoursStr) return undefined;
  return [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '09:00',
      closes: '18:00',
    },
  ];
}

function getGoogleReviewsAggregate() {
  const data = content.googleReviewsData;
  if (!data?.rating) return null;
  const reviewCount = data.reviewCount ?? (data.reviews?.length || null);
  if (!reviewCount) return null;
  return {
    '@type': 'AggregateRating',
    ratingValue: data.rating,
    reviewCount,
  };
}

function buildJsonLd(route) {
  const social = content.social || {};
  const sameAs = [social.facebook, social.instagram, social.linkedin].filter(Boolean);
  const openingHours = parseOpeningHours(content.contact.hours);
  const googleReviewsAggregate = getGoogleReviewsAggregate();

  const localBusiness = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${siteUrl}/#localbusiness`,
    name: content.company.fullName,
    alternateName: content.company.name,
    description: content.meta.description,
    url: siteUrl,
    image: ogImage,
    telephone: content.contact.phone,
    email: content.contact.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: content.contact.address,
      addressLocality: 'Guwahati',
      addressRegion: 'Assam',
      postalCode: '781003',
      addressCountry: 'IN',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 26.1445,
      longitude: 91.7362,
    },
    areaServed: [
      { '@type': 'City', name: 'Guwahati' },
      { '@type': 'State', name: 'Assam' },
      { '@type': 'Place', name: 'Northeast India' },
    ],
    slogan: content.company.tagline,
    knowsAbout: [
      ...content.services.map((s) => s.title),
      ...(content.problems || []).map((p) => p.title),
      'Earthquake monitoring',
      'Seismic activity near Guwahati',
      'Seismic Zone V',
      'Northeast India earthquakes',
    ],
    ...(openingHours ? { openingHoursSpecification: openingHours } : {}),
    ...(googleReviewsAggregate ? { aggregateRating: googleReviewsAggregate } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };

  const faqItems = (() => {
    if (route === '/' && content.homeownerFaq?.items?.length) {
      return content.homeownerFaq.items;
    }
    if (route === '/earthquakes' && content.earthquakes?.faq?.length) {
      return content.earthquakes.faq;
    }
    const localLanding = (content.localLandings || []).find((l) => route === `/guwahati/${l.slug}`);
    if (localLanding?.faqs?.length) return localLanding.faqs;
    const problem = (content.problems || []).find((p) => route === `/problems/${p.slug}`);
    return problem?.faqs || [];
  })();

  const serviceSchemaNames = {
    '/services/waterproofing': 'Waterproofing in Guwahati',
    '/services/retrofitting': 'Building retrofitting in Guwahati',
  };
  const localLandingRoute = (content.localLandings || []).find((l) => route === `/guwahati/${l.slug}`);
  const serviceSchemaName = serviceSchemaNames[route] || localLandingRoute?.serviceSchemaName;

  const graphs = [localBusiness];

  if (serviceSchemaName) {
    graphs.push({
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: serviceSchemaName,
      provider: { '@id': `${siteUrl}/#localbusiness` },
      areaServed: { '@type': 'City', name: 'Guwahati' },
      url: `${siteUrl}${publicRoute(route)}`,
    });
  }

  if (route === '/earthquakes') {
    graphs.push({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${siteUrl}/earthquakes#webpage`,
      name: content.earthquakes?.seoTitle || 'Earthquakes near Guwahati today',
      description: content.earthquakes?.seoDescription || content.earthquakes?.subhead,
      url: `${siteUrl}/earthquakes`,
      isPartOf: { '@type': 'WebSite', name: content.company.fullName, url: siteUrl },
      about: [
        { '@type': 'Thing', name: 'Earthquake' },
        { '@type': 'Place', name: 'Guwahati, Assam, India' },
        { '@type': 'Place', name: 'Northeast India' },
      ],
    });
  }

  if (faqItems.length) {
    graphs.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((faq) => ({
        '@type': 'Question',
        name: faq.q,
        acceptedAnswer: { '@type': 'Answer', text: faq.a },
      })),
    });
  }

  return graphs.length === 1 ? graphs[0] : graphs;
}

function heroImagePath() {
  const img = content.hero?.image || 'images/hero.jpg';
  const base = img.startsWith('/') ? img : `/${img}`;
  return base.replace(/\.(jpe?g|png)$/i, '.webp');
}

function buildHeroPreload() {
  const href = heroImagePath();
  return `<link rel="preload" as="image" href="${href}" type="image/webp" fetchpriority="high" />`;
}

function buildHeroPrerender(route) {
  if (route !== '/') return '';
  const hero = content.hero;
  if (!hero) return '';

  return `<section id="hero-prerender" class="hero-prerender" aria-hidden="true">
      <div class="wrap hero-grid">
        <div class="hero-copy">
          <span class="eyebrow">${escapeHtml(hero.eyebrow)}</span>
          <p class="hero-headline">${escapeHtml(hero.headline)}</p>
          <p class="hero-sub">${escapeHtml(hero.subheadline)}</p>
        </div>
      </div>
    </section>`;
}

function loadGtmId() {
  if (process.env.VITE_GTM_ID) return process.env.VITE_GTM_ID.trim();
  const envPath = path.join(root, 'frontend/.env');
  if (fs.existsSync(envPath)) {
    const match = fs.readFileSync(envPath, 'utf8').match(/^VITE_GTM_ID=(.+)$/m);
    if (match) return match[1].trim();
  }
  return '';
}

function buildGtmHead(gtmId) {
  if (!gtmId) return '';
  const id = escapeHtml(gtmId);
  return `<!-- Google Tag Manager -->
    <script>window.dataLayer=window.dataLayer||[];window.dataLayer.push({'analytics_storage':'denied','ad_storage':'denied','ad_user_data':'denied','ad_personalization':'denied'});(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;j.id='gtm-script';f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');</script>
    <!-- End Google Tag Manager -->`;
}

function buildGtmBody(gtmId) {
  if (!gtmId) return '';
  const id = escapeHtml(gtmId);
  return `<!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->`;
}

function buildContentBootstrap() {
  const enJson = JSON.stringify(contentEn).replace(/</g, '\\u003c');
  let out = `<script>window.__CONTENT__=${enJson}</script>`;
  if (contentAs) {
    const asJson = JSON.stringify(contentAs).replace(/</g, '\\u003c');
    out += `\n    <script>window.__CONTENT_AS__=${asJson}</script>`;
  }
  return out;
}

function buildSeoHead(route, title, description) {
  const publicPath = publicRoute(route);
  const canonical =
    publicPath === '/' || publicPath === '/as'
      ? `${siteUrl}${publicPath}/`
      : `${siteUrl}${publicPath}`;
  const enHref = route === '/' ? `${siteUrl}/` : `${siteUrl}${route}`;
  const asHref = route === '/' ? `${siteUrl}/as/` : `${siteUrl}/as${route}`;
  const hreflang = contentAs
    ? `
    <link rel="alternate" hreflang="en" href="${enHref}" />
    <link rel="alternate" hreflang="as" href="${asHref}" />
    <link rel="alternate" hreflang="x-default" href="${enHref}" />`
    : '';
  const htmlLang = activeLocale === 'as' ? 'as' : 'en';
  return `<!-- seo:injected -->
    <link rel="canonical" href="${canonical}" />${hreflang}
    <meta property="og:locale" content="${activeLocale === 'as' ? 'as_IN' : 'en_IN'}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${ogImage}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${ogImage}" />
    <script type="application/ld+json">${JSON.stringify(buildJsonLd(route))}</script>`;
}

function buildStaticArticle(route) {
  return `<article id="static-content">
      ${buildRouteBody(route)}
      ${buildStaticFooterNav()}
    </article>`;
}

function buildStaticContentHideStyle() {
  return `<style id="static-content-hide">
#static-content{max-width:48rem;margin:0 auto;padding:1rem 1.25rem;line-height:1.5;font-size:0.9375rem}
#static-content a{color:inherit}
#static-content ol{padding-left:1.25rem}
body.app-ready #static-content{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);clip-path:inset(50%);white-space:nowrap;border:0}
</style>`;
}

function applySeoToHtml(html, route) {
  const { title, description } = routeMeta(route);
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const publicPath = publicRoute(route);
  const canonical =
    publicPath === '/' || publicPath === '/as'
      ? `${siteUrl}${publicPath}/`
      : `${siteUrl}${publicPath}`;

  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${safeTitle}</title>`);
  out = out.replace(
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${safeDescription}" />`,
  );
  out = out.replace(/<html lang="[^"]*">/, `<html lang="${activeLocale === 'as' ? 'as' : 'en'}">`);

  const seoBlock = buildSeoHead(route, safeTitle, safeDescription);
  const hideStyle = buildStaticContentHideStyle();
  const perfBlock = `${buildHeroPreload()}\n    ${buildContentBootstrap()}`;
  if (out.includes('<!-- seo:injected -->')) {
    out = out.replace('<!-- seo:injected -->', `${seoBlock}\n    ${hideStyle}\n    ${perfBlock}`);
  } else {
    out = out.replace('</head>', `    ${seoBlock}\n    ${hideStyle}\n    ${perfBlock}\n  </head>`);
  }

  const article = buildStaticArticle(route);
  const heroPrerender = buildHeroPrerender(route);
  if (out.includes('id="static-content"')) {
    out = out.replace(/<article id="static-content">[\s\S]*?<\/article>/, article);
  } else {
    out = out.replace('<div id="root">', `${article}\n    <div id="root">`);
  }

  if (heroPrerender) {
    out = out.replace('<div id="root">', `${heroPrerender}\n    <div id="root">`);
  }

  return out;
}

function writeRobotsTxt() {
  fs.writeFileSync(
    path.join(distDir, 'robots.txt'),
    `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`,
  );
}

function writeSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const localeConfigs = [{ locale: 'en', prefix: '' }];
  if (contentAs) localeConfigs.push({ locale: 'as', prefix: '/as' });

  const urls = localeConfigs
    .flatMap(({ prefix }) =>
      SITEMAP_ROUTES.map((route) => {
        const publicPath = prefix ? (route === '/' ? '/as' : `${prefix}${route}`) : route;
        const loc =
          publicPath === '/' || publicPath === '/as'
            ? `${siteUrl}${publicPath}/`
            : `${siteUrl}${publicPath}`;
        const { priority, changefreq } = sitemapMeta(route);
        const changefreqLine = changefreq ? `\n    <changefreq>${changefreq}</changefreq>` : '';
        return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>${changefreqLine}\n    <priority>${priority}</priority>\n  </url>`;
      }),
    )
    .join('\n');

  fs.writeFileSync(
    path.join(distDir, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`,
  );
}

function writeLlmsTxt() {
  const navLinks = [
    ...content.nav,
    { label: 'Services', href: '/services' },
    ...(content.navServices || []).filter(
      (item) => item.href !== '/services' && item.label !== 'All services',
    ),
    ...(content.navTools || []),
    ...content.navMore,
  ]
    .map((item) => `- [${item.label}](${siteUrl}${item.href})`)
    .join('\n');

  const problemQa = (content.problems || [])
    .slice(0, 15)
    .flatMap((p) => (p.faqs || []).map((f) => `Q: ${f.q}\nA: ${f.a}`))
    .join('\n\n');

  const knowledgeList = (content.knowledgeArticles || [])
    .map((a) => `- [${a.title}](${siteUrl}/knowledge/${a.slug}): ${a.excerpt}`)
    .join('\n');

  const problemsList = (content.problems || [])
    .map((p) => `- [${p.title}](${siteUrl}/problems/${p.slug}): ${p.headline}`)
    .join('\n');

  const body = `# ${content.company.fullName}

> ${content.meta.description}

${content.company.fullName} (${content.company.name}) is a building rehabilitation specialist in Guwahati, Assam, Northeast India (Seismic Zone 5). We diagnose building problems first — leaks, cracks, dampness, spalling — then prescribe structural repair, waterproofing, PU/epoxy injection, CFRP strengthening, and NDT testing.

## Contact

- Phone: ${content.contact.phone}
- Email: ${content.contact.email}
- Address: ${content.contact.address}, Guwahati, Assam 781003, India
- Hours: ${content.contact.hours}
- Service area: Guwahati, Assam, Northeast India

## Common building problems (Guwahati)

${problemsList}

## Problem Q&A

${problemQa}

## Services

${content.services.map((s) => `- [${s.title}](${siteUrl}/services/${s.slug}): ${s.description}`).join('\n')}

## Guwahati local services

${(content.localLandings || []).map((l) => `- [${l.headline}](${siteUrl}/guwahati/${l.slug}): ${l.intro.slice(0, 120)}…`).join('\n')}

## Knowledge Centre

${knowledgeList}

## Live earthquakes (Guwahati & Northeast India)

- [Earthquakes near Guwahati today](${siteUrl}/earthquakes): Live USGS map and recent tremors in Assam and Northeast India. Enable location to see earthquakes near you.
- [Seismic Zone V homeowner guide](${siteUrl}/knowledge/seismic-zone-5-guwahati-homeowner)
- [Seismic jacketing & retrofitting](${siteUrl}/services/seismic-jacketing)

## Key Stats

${content.stats.map(statLabel).map((s) => `- ${s}`).join('\n')}

## Clients

${content.clients.map((c) => `- ${c.name} (${c.location})`).join('\n')}

## Selected Projects

${content.projects.map((p) => `- ${p.title} (${p.category}, ${p.location}, ${p.year}): ${p.scope}`).join('\n')}

## Process

${content.process.map((p) => `${p.step}. **${p.title}** — ${p.description}`).join('\n')}

## About

${content.about.body.join('\n\n')}

## Pages

${navLinks}

## Machine-readable content

- JSON API: ${siteUrl}/api/content
`;
  fs.writeFileSync(path.join(distDir, 'llms.txt'), body);
}

function writeRoutePages(baseHtml) {
  const locales = contentAs ? ['en', 'as'] : ['en'];
  for (const locale of locales) {
    setActiveLocale(locale);
    const routes = buildRoutesFromContent(content);
    for (const route of routes) {
      const html = applySeoToHtml(baseHtml, route);
      const publicPath = publicRoute(route);
      if (publicPath === '/' || publicPath === '/as') {
        const file =
          publicPath === '/as'
            ? path.join(distDir, 'as', 'index.html')
            : path.join(distDir, 'index.html');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, html);
        continue;
      }

      const dir = path.join(distDir, publicPath.slice(1));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), html);
    }
  }
  setActiveLocale('en');
}

if (!fs.existsSync(distDir)) {
  console.error('[seo] frontend/dist not found — run vite build first');
  process.exit(1);
}

const indexPath = path.join(distDir, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('[seo] dist/index.html not found');
  process.exit(1);
}

async function main() {
  try {
    earthquakeSnapshot = await fetchNeEarthquakes({ limit: 20 });
    console.log('[seo] pre-rendered', earthquakeSnapshot.events.length, 'USGS events for Northeast India');
  } catch (err) {
    console.warn('[seo] USGS fetch failed — earthquake list will be empty in static HTML:', err.message);
    earthquakeSnapshot = { events: [], fetchedAt: Date.now(), source: 'USGS' };
  }

  const baseHtml = fs.readFileSync(indexPath, 'utf8');

  writeRobotsTxt();
  writeSitemap();
  writeLlmsTxt();
  writeRoutePages(baseHtml);

  const sitemapCount = contentAs ? SITEMAP_ROUTES.length * 2 : SITEMAP_ROUTES.length;
  console.log(
    '[seo] wrote robots.txt, sitemap.xml, llms.txt, and static HTML for',
    ROUTES.length,
    'routes x',
    contentAs ? 2 : 1,
    'locales (sitemap:',
    sitemapCount,
    'urls)',
  );
}

main().catch((err) => {
  console.error('[seo] fatal:', err);
  process.exit(1);
});
