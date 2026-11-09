import LocalizedLink from './LocalizedLink';
import SectionHead from './SectionHead';

export default function HomeownerFaq({ data }) {
  if (!data?.items?.length) return null;

  return (
    <section className="homeowner-faq">
      <div className="wrap">
        <SectionHead eyebrow={data.eyebrow} headline={data.headline} />
        <div className="faq-list" role="list">
          {data.items.map((item) => (
            <details key={item.q} className="faq-item panel" role="listitem">
              <summary>{item.q}</summary>
              <div className="faq-answer">
                <p>{item.a}</p>
                {item.link && (
                  <p className="faq-link">
                    <LocalizedLink to={item.link.href}>{item.link.label}</LocalizedLink>
                  </p>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
