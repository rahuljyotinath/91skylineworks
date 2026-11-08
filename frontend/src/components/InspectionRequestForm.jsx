import { useState } from 'react';
import { useFormTurnstile } from '../hooks/useFormTurnstile';
import { submitLead, successMessage } from '../lib/submitLead';
import { trackLead } from '../utils/analytics';
import FormSuccessModal from './FormSuccessModal';

export default function InspectionRequestForm({ id = 'inspection-form', compact = false }) {
  const [form, setForm] = useState({ name: '', phone: '', locality: '', issue: '' });
  const [error, setError] = useState(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMessageText, setSuccessMessageText] = useState('');
  const { token: turnstileToken, assertReady, reset: resetTurnstile, widget: turnstileWidget } =
    useFormTurnstile();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!form.phone.trim()) {
      setError('Please enter your phone number');
      return;
    }
    if (!form.locality.trim()) {
      setError('Please enter your area or locality');
      return;
    }
    if (!form.issue.trim()) {
      setError('Please describe the issue briefly');
      return;
    }

    try {
      assertReady();
      const data = await submitLead({
        name: form.name.trim(),
        phone: form.phone.trim(),
        locality: form.locality.trim(),
        source: 'inspection',
        metadata: { issue: form.issue.trim() },
        turnstileToken,
      });
      const firstName = form.name.trim().split(' ')[0];
      setSuccessMessageText(successMessage(data, firstName));
      setSuccessOpen(true);
      trackLead('inspection');
      setForm({ name: '', phone: '', locality: '', issue: '' });
      resetTurnstile();
    } catch (err) {
      setError(err.message === 'Submission failed' ? 'Something went wrong — please call us directly' : err.message);
    }
  };

  return (
    <>
      <form id={id} className={`form panel inspection-form ${compact ? 'inspection-form--compact' : ''}`} onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="insp-name">Your name</label>
          <input
            id="insp-name"
            type="text"
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="insp-phone">Phone</label>
          <input
            id="insp-phone"
            type="tel"
            placeholder="+91 98…"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="insp-locality">Area / locality</label>
          <input
            id="insp-locality"
            type="text"
            placeholder="Beltola, Chandmari, Six Mile…"
            value={form.locality}
            onChange={(e) => setForm({ ...form, locality: e.target.value })}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="insp-issue">What's the problem?</label>
          <textarea
            id="insp-issue"
            placeholder="Roof leak, wall crack, damp bathroom…"
            value={form.issue}
            onChange={(e) => setForm({ ...form, issue: e.target.value })}
            required
          />
        </div>
        {turnstileWidget}
        <button type="submit" className="btn-conversion btn-conversion--inspection" style={{ width: '100%' }}>
          Book free inspection
        </button>
        {error && <p className="form-note is-error">{error}</p>}
      </form>
      <FormSuccessModal
        open={successOpen}
        message={successMessageText}
        onClose={() => setSuccessOpen(false)}
      />
    </>
  );
}
