import { useMemo, useState } from 'react';
import SectionReveal from './SectionReveal';
import FormSuccessModal from './FormSuccessModal';
import MediaUploadField from './MediaUploadField';
import FieldSelect from './FieldSelect';
import { useFormTurnstile } from '../hooks/useFormTurnstile';
import { submitLead, successMessage } from '../lib/submitLead';
import { trackLead } from '../utils/analytics';
import './ContactArray.css';

function buildCategoryOptions(serviceCategories, navServices) {
  if (serviceCategories?.length) {
    return serviceCategories.map((c) => ({ value: c.label, label: c.label }));
  }
  return (navServices || [])
    .filter((item) => item.label !== 'All services')
    .map((item) => ({ value: item.label, label: item.label }));
}

export default function ContactArray({ contact, serviceCategories, navServices }) {
  const [error, setError] = useState(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMessageText, setSuccessMessageText] = useState('');
  const [files, setFiles] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '', email: '', scope: '', msg: '' });
  const { token: turnstileToken, assertReady, reset: resetTurnstile, widget: turnstileWidget } =
    useFormTurnstile();

  const categoryOptions = useMemo(
    () => buildCategoryOptions(serviceCategories, navServices),
    [serviceCategories, navServices]
  );

  if (!contact) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!form.phone.trim() && !form.email.trim()) {
      setError('Please add a phone number or email so we can reach you');
      return;
    }
    try {
      assertReady();
      const data = await submitLead({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        locality: form.scope,
        source: 'contact',
        metadata: { message: form.msg.trim() },
        files,
        turnstileToken,
      });
      const firstName = form.name.trim().split(' ')[0];
      setSuccessMessageText(successMessage(data, firstName));
      setSuccessOpen(true);
      trackLead('contact');
      setForm({ name: '', phone: '', email: '', scope: '', msg: '' });
      setFiles([]);
      resetTurnstile();
    } catch (err) {
      setError(err.message === 'Submission failed' ? 'Something went wrong — please call us directly' : err.message);
    }
  };

  return (
    <section id="contact">
      <div className="wrap contact-grid">
        <SectionReveal className="contact-copy">
          <span className="eyebrow">{contact.eyebrow}</span>
          <h2>{contact.headline}</h2>
          <p>{contact.body}</p>
          <div className="contact-rows">
            {contact.phone && (
              <div className="crow">
                <span className="k">Phone</span>
                <span className="v">
                  <a href={`tel:${contact.phone.replace(/[^0-9+]/g, '')}`} data-track="click_phone">{contact.phone}</a>
                </span>
              </div>
            )}
            {contact.email && (
              <div className="crow">
                <span className="k">Email</span>
                <span className="v">
                  <a href={`mailto:${contact.email}`} data-track="click_email">{contact.email}</a>
                </span>
              </div>
            )}
            {contact.address && (
              <div className="crow">
                <span className="k">Office</span>
                <span className="v">{contact.address}</span>
              </div>
            )}
            {contact.hours && (
              <div className="crow">
                <span className="k">Hours</span>
                <span className="v">{contact.hours}</span>
              </div>
            )}
          </div>
        </SectionReveal>
        <SectionReveal>
          <form className="form panel" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="f-name">Your name</label>
              <input
                id="f-name"
                type="text"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="f-phone">Phone</label>
              <input
                id="f-phone"
                type="tel"
                placeholder="+91 98…"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="f-email">Email</label>
              <input
                id="f-email"
                type="email"
                placeholder="you@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <FieldSelect
              id="f-scope"
              label="What do you need help with?"
              value={form.scope}
              onChange={(scope) => setForm({ ...form, scope })}
              options={categoryOptions}
              placeholder="Select…"
            />
            <div className="field">
              <label htmlFor="f-msg">Tell us more</label>
              <textarea
                id="f-msg"
                placeholder="Crack location, leak details, area in Guwahati…"
                value={form.msg}
                onChange={(e) => setForm({ ...form, msg: e.target.value })}
              />
            </div>
            <MediaUploadField files={files} onChange={setFiles} />
            {turnstileWidget}
            <button type="submit" className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }}>
              Send message <span className="arrow">→</span>
            </button>
            {error && <p className="form-note">{error}</p>}
          </form>
        </SectionReveal>
      </div>
      <FormSuccessModal
        open={successOpen}
        message={successMessageText}
        onClose={() => setSuccessOpen(false)}
      />
    </section>
  );
}
