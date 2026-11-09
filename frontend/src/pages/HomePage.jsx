import { lazy, Suspense } from 'react';
import { useOutletContext } from 'react-router-dom';
import LocalizedLink from '../components/LocalizedLink';
import HeroLanding from '../components/HeroLanding';
import StatsBar from '../components/StatsBar';
import ProblemGrid from '../components/ProblemGrid';
import DoctorPositioning from '../components/DoctorPositioning';
import DeferredViewport from '../components/DeferredViewport';
import usePageTitle from '../hooks/usePageTitle';

const HomePageBelowFold = lazy(() => import('./HomePageBelowFold'));

export default function HomePage() {
  const { content } = useOutletContext();
  const hs = content.homeSections || {};

  usePageTitle('Building Doctor — Guwahati');

  return (
    <>
      <HeroLanding hero={content.hero} company={content.company} />
      <StatsBar stats={content.stats} />
      {hs.problemGrid && (
        <ProblemGrid
          grid={content.homeProblemGrid}
          categories={content.problemCategories}
          problems={content.problems}
          limit={6}
        />
      )}
      {hs.doctorPositioning && <DoctorPositioning data={content.doctorPositioning} showCta={false} />}
      <section className="local-seo-links">
        <div className="wrap">
          <p className="local-seo-links-label">Popular in Guwahati</p>
          <ul>
            <li>
              <LocalizedLink to="/guwahati/waterproofing">Waterproofing in Guwahati</LocalizedLink>
            </li>
            <li>
              <LocalizedLink to="/guwahati/building-crack-repair">Building crack repair in Guwahati</LocalizedLink>
            </li>
            <li>
              <LocalizedLink to="/services/retrofitting">Building retrofitting in Guwahati</LocalizedLink>
            </li>
          </ul>
        </div>
      </section>
      <DeferredViewport minHeight="24rem" rootMargin="280px 0px">
        <Suspense fallback={null}>
          <HomePageBelowFold content={content} hs={hs} />
        </Suspense>
      </DeferredViewport>
    </>
  );
}
