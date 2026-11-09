import GoogleReviews from '../components/GoogleReviews';
import EarthquakeHomeSection from '../components/EarthquakeHomeSection';
import ServicesGrid from '../components/ServicesGrid';
import ProjectsShowcase from '../components/ProjectsShowcase';
import ProcessGrid from '../components/ProcessGrid';
import AboutSection from '../components/AboutSection';
import ClientsGrid from '../components/ClientsGrid';
import BackingSection from '../components/BackingSection';
import HomeownerFaq from '../components/HomeownerFaq';
import GuidesTeaser from '../components/GuidesTeaser';
import ContactTeaser from '../components/ContactTeaser';
import InspectionCTA from '../components/InspectionCTA';
import PagePreview from '../components/PagePreview';
import InspectionRequestForm from '../components/InspectionRequestForm';
import SectionHead from '../components/SectionHead';

export default function HomePageBelowFold({ content, hs = {} }) {
  return (
    <>
      <section className="inspection-form-section">
        <div className="wrap">
          <SectionHead
            eyebrow="Free inspection"
            headline="Book a site visit in Guwahati"
            sub="Name, phone, locality, and a brief description — we'll call to confirm."
          />
          <InspectionRequestForm id="inspection-form" />
        </div>
      </section>
      {hs.inspectionCta && <InspectionCTA data={hs.inspectionCta} showPrimary={false} />}
      <GoogleReviews heading={hs.googleReviews} data={content.googleReviewsData} />
      <section>
        <div className="wrap">
          {hs.earthquakes && (
            <SectionHead eyebrow={hs.earthquakes.eyebrow} headline={hs.earthquakes.headline} />
          )}
          <EarthquakeHomeSection copy={content.earthquakes} limit={5} />
        </div>
      </section>
      <PagePreview heading={hs.capabilities} to="/services" linkLabel="View all services">
        <ServicesGrid services={content.services} bare />
      </PagePreview>
      <PagePreview heading={hs.work} to="/portfolio" linkLabel="View all projects" id="work" className="section-work">
        <ProjectsShowcase projects={content.projects} limit={3} bare />
      </PagePreview>
      <div className="hazard" />
      <ProcessGrid process={content.process} heading={hs.process} />
      <PagePreview heading={hs.team} to="/about" linkLabel="Meet the team">
        <AboutSection about={content.about} company={content.company} excerpt bare />
      </PagePreview>
      <PagePreview heading={hs.clients} to="/portfolio#clients" linkLabel="View all clients">
        <ClientsGrid clients={content.clients} limit={4} bare />
      </PagePreview>
      <PagePreview heading={hs.backing} to="/about#backing" linkLabel="Learn more">
        <BackingSection backing={content.backing} limit={3} bare />
      </PagePreview>
      <HomeownerFaq data={content.homeownerFaq} />
      <GuidesTeaser articles={content.knowledgeArticles} heading={hs.guides} />
      <ContactTeaser contact={content.contact} heading={hs.contact} teaser={content.contactTeaser} />
    </>
  );
}
