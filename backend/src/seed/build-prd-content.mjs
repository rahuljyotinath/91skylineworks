#!/usr/bin/env node
/**
 * Merges PRD extension content into backend/src/seed/content.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentPath = path.join(__dirname, 'content.json');
const extDir = path.join(__dirname, 'extensions');

const REMOVED_SERVICE_SLUGS = new Set(['industrial-flooring', 'facade-restoration']);

function withoutRemovedServices(items) {
  return (items || []).filter((item) => !REMOVED_SERVICE_SLUGS.has(item.slug));
}

function loadJson(name) {
  const file = path.join(extDir, name);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const base = JSON.parse(fs.readFileSync(contentPath, 'utf8'));

const problems = loadJson('problems.json') || [];
const knowledgeArticles = loadJson('knowledge-articles.json') || [];
const additionalServices = loadJson('additional-services.json') || { services: [], servicePages: [] };
const prdOverrides = loadJson('prd-overrides.json') || {};
const servicePatches = loadJson('service-patches.json') || {};
const conversionPhase = loadJson('conversion-phase.json') || {};
const conversionKnowledge = loadJson('conversion-knowledge.json') || [];
const earthquakesSeo = loadJson('earthquakes-seo.json') || {};
const serviceCategoriesExt = loadJson('service-categories.json') || {};
const seoOverrides = loadJson('seo-overrides.json') || {};
const localLandingsExt = loadJson('local-landings.json') || {};
const competitiveExt = loadJson('competitive.json') || {};

const merged = {
  ...base,
  ...prdOverrides,
  hero: { ...base.hero, ...(prdOverrides.hero || {}), ...(conversionPhase.hero || {}) },
  homeSections: {
    ...base.homeSections,
    ...(prdOverrides.homeSections || {}),
    ...(conversionPhase.homeSections || {}),
  },
  meta: { ...base.meta, ...(prdOverrides.meta || {}) },
  contact: { ...base.contact, ...(conversionPhase.contact || {}) },
  problems,
  industries: [],
  knowledgeArticles,
  problemCategories: prdOverrides.problemCategories || [],
  homeProblemGrid: prdOverrides.homeProblemGrid || null,
  doctorPositioning: prdOverrides.doctorPositioning || null,
};

if (conversionPhase.googleReviewsData) merged.googleReviewsData = conversionPhase.googleReviewsData;
delete merged.testimonials;
if (merged.homeSections) delete merged.homeSections.testimonials;
if (conversionPhase.homeownerFaq) merged.homeownerFaq = conversionPhase.homeownerFaq;
if (conversionPhase.contactTeaser) merged.contactTeaser = conversionPhase.contactTeaser;

if (conversionPhase.navMore) {
  merged.navMore = conversionPhase.navMore;
}

delete merged.servicesHome;

if (additionalServices.services?.length) {
  const slugs = new Set(merged.services.map((s) => s.slug));
  for (const svc of additionalServices.services) {
    if (REMOVED_SERVICE_SLUGS.has(svc.slug) || slugs.has(svc.slug)) continue;
    merged.services.push(svc);
  }
  merged.services.sort((a, b) => String(a.code).localeCompare(String(b.code)));
}

merged.services = withoutRemovedServices(merged.services);

for (const svc of merged.services) {
  delete svc.audience;
}

if (conversionKnowledge.length) {
  const slugs = new Set(merged.knowledgeArticles.map((a) => a.slug));
  for (const article of conversionKnowledge) {
    if (!slugs.has(article.slug)) merged.knowledgeArticles.push(article);
  }
}

if (additionalServices.servicePages?.length) {
  merged.servicePages = merged.servicePages || [];
  const bySlug = new Map(merged.servicePages.map((p) => [p.slug, p]));
  for (const page of additionalServices.servicePages) {
    if (REMOVED_SERVICE_SLUGS.has(page.slug)) continue;
    if (bySlug.has(page.slug)) {
      Object.assign(bySlug.get(page.slug), page);
    } else {
      merged.servicePages.push(page);
      bySlug.set(page.slug, page);
    }
  }
}

merged.servicePages = withoutRemovedServices(merged.servicePages);

for (const page of merged.servicePages || []) {
  const patch = servicePatches[page.slug];
  if (!patch) continue;
  if (patch.sections) page.sections = patch.sections;
  if (patch.awareness) page.awareness = { ...page.awareness, ...patch.awareness };
  if (patch.intro) page.intro = patch.intro;
  if (patch.headline) page.headline = patch.headline;
  if (patch.offerings) page.offerings = patch.offerings;
  if (patch.ctaMessage) page.ctaMessage = patch.ctaMessage;
  if (patch.seoTitle) page.seoTitle = patch.seoTitle;
  if (patch.seoHeadline) page.seoHeadline = patch.seoHeadline;
}

for (const page of merged.servicePages || []) {
  const seo = seoOverrides.servicePages?.[page.slug];
  if (!seo) continue;
  if (seo.seoTitle) page.seoTitle = seo.seoTitle;
  if (seo.seoHeadline) page.seoHeadline = seo.seoHeadline;
}

for (const problem of merged.problems || []) {
  const seo = seoOverrides.problems?.[problem.slug];
  if (!seo) continue;
  if (seo.seoTitle) problem.seoTitle = seo.seoTitle;
}

for (const article of merged.knowledgeArticles || []) {
  const seo = seoOverrides.knowledgeArticles?.[article.slug];
  if (!seo) continue;
  if (seo.linkedServices) article.linkedServices = seo.linkedServices;
  if (seo.linkedProblems) article.linkedProblems = seo.linkedProblems;
}

if (additionalServices.projects?.length) {
  merged.projects = additionalServices.projects;
}

if (earthquakesSeo.earthquakes) {
  merged.earthquakes = { ...merged.earthquakes, ...earthquakesSeo.earthquakes };
}

if (serviceCategoriesExt.serviceCategories) {
  merged.serviceCategories = serviceCategoriesExt.serviceCategories;
  for (const cat of merged.serviceCategories) {
    const seo = seoOverrides.serviceCategories?.[cat.slug];
    if (seo?.seoTitle) cat.seoTitle = seo.seoTitle;
  }
}

if (localLandingsExt.localLandings?.length) {
  merged.localLandings = localLandingsExt.localLandings;
}
if (serviceCategoriesExt.navServices) {
  merged.navServices = serviceCategoriesExt.navServices;
}
if (seoOverrides.navServicesHub?.length) {
  const existing = new Set((merged.navServices || []).map((item) => item.href));
  const hubItems = seoOverrides.navServicesHub.filter((item) => !existing.has(item.href));
  merged.navServices = [...hubItems, ...(merged.navServices || [])];
}
const categoryMap = serviceCategoriesExt.serviceCategoryMap || {};
if (Object.keys(categoryMap).length) {
  for (const svc of merged.services) {
    if (categoryMap[svc.slug]) {
      svc.category = categoryMap[svc.slug];
    }
  }
}
if (merged.nav) {
  merged.nav = merged.nav.filter((item) => item.href !== '/services' && item.label !== 'Services');
}

if (competitiveExt.inspectionSla) {
  merged.inspectionSla = competitiveExt.inspectionSla;
  if (merged.homeSections?.inspectionCta) {
    merged.homeSections.inspectionCta.slaNote =
      `${competitiveExt.inspectionSla.callback}. ${competitiveExt.inspectionSla.visit}.`;
  }
}
if (competitiveExt.diagnosisPack) merged.diagnosisPack = competitiveExt.diagnosisPack;
if (competitiveExt.partnerCredentials) merged.partnerCredentials = competitiveExt.partnerCredentials;
if (competitiveExt.portfolioIntro) merged.portfolioIntro = competitiveExt.portfolioIntro;

if (competitiveExt.serviceWarranty) {
  for (const page of merged.servicePages || []) {
    const warranty = competitiveExt.serviceWarranty[page.slug];
    if (warranty) page.warranty = warranty;
  }
}

if (competitiveExt.projectCaseStudies && merged.projects?.length) {
  merged.projects = merged.projects.map((project) => {
    const extra = competitiveExt.projectCaseStudies[project.slug];
    return extra ? { ...project, ...extra } : project;
  });
}

fs.writeFileSync(contentPath, `${JSON.stringify(merged, null, 2)}\n`);
console.log('[prd-content] merged', {
  problems: problems.length,
  knowledgeArticles: merged.knowledgeArticles.length,
  services: merged.services.length,
  servicePages: merged.servicePages.length,
  projects: merged.projects.length,
  googleReviews: merged.googleReviewsData?.rating ? 1 : 0,
});
