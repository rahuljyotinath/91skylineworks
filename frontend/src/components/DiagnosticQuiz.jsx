import { useState } from 'react';
import SectionReveal from './SectionReveal';
import FormSuccessModal from './FormSuccessModal';
import MediaUploadField from './MediaUploadField';
import { useFormTurnstile } from '../hooks/useFormTurnstile';
import { submitLead, successMessage } from '../lib/submitLead';
import { trackLead } from '../utils/analytics';
import './DiagnosticQuiz.css';

const AGE_OPTIONS = [
  { id: 'pre-2002', label: 'Pre-2002 Construction (High failure matrix — no ductile detailing)' },
  { id: '2002-2016', label: '2002–2016' },
  { id: 'post-2016', label: 'Post-2016' },
];

const SYMPTOM_OPTIONS = [
  { id: 'diagonal', label: 'Diagonal fracturing through columns or beam joints' },
  { id: 'seepage', label: 'Active sub-surface capillary water sweating or damp tracking' },
  { id: 'spalling', label: 'Plaster spalling with oxidized brown rebar lines' },
];

const ELEVATION_OPTIONS = [
  { id: 'lower', label: 'Property foundation line sits lower than municipal street level' },
  { id: 'uniform', label: 'Uniform elevation axis' },
];

export default function DiagnosticQuiz({ contact }) {
  const [answers, setAnswers] = useState({ age: '', symptom: '', elevation: '' });
  const [submitted, setSubmitted] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: '', phone: '', loc: '' });
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMessageText, setSuccessMessageText] = useState('');
  const { token: turnstileToken, assertReady, reset: resetTurnstile, widget: turnstileWidget } =
    useFormTurnstile();

  const isCritical =
    answers.age === 'pre-2002' &&
    answers.symptom === 'diagonal' &&
    answers.elevation === 'lower';

  const allAnswered = answers.age && answers.symptom && answers.elevation;
  const phone = contact?.phone || '+91 60038 79490';
  const tel = phone.replace(/[^0-9+]/g, '');

  const handleLead = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      assertReady();
      const data = await submitLead({
        name: leadForm.name,
        phone: leadForm.phone,
        locality: leadForm.loc,
        source: 'quiz',
        metadata: answers,
        files,
        turnstileToken,
      });
      const firstName = leadForm.name.trim().split(' ')[0];
      setSuccessMessageText(successMessage(data, firstName));
      setSuccessOpen(true);
      trackLead('assessment');
      setLeadForm({ name: '', phone: '', loc: '' });
      setFiles([]);
      resetTurnstile();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section id="quiz">
      <div className="wrap">
        <SectionReveal className="section-head">
          <span className="eyebrow">Self-Diagnostic Wizard</span>
          <h2>Structural threat profiling matrix.</h2>
        </SectionReveal>

        {!submitted ? (
          <div className="quiz-form panel">
            <fieldset>
              <legend className="mono">Structural Frame Age</legend>
              {AGE_OPTIONS.map((o) => (
                <label key={o.id} className="quiz-option">
                  <input
                    type="radio"
                    name="age"
                    value={o.id}
                    checked={answers.age === o.id}
                    onChange={() => setAnswers({ ...answers, age: o.id })}
                  />
                  {o.label}
                </label>
              ))}
            </fieldset>

            <fieldset>
              <legend className="mono">Primary Macroscopic Symptom</legend>
              {SYMPTOM_OPTIONS.map((o) => (
                <label key={o.id} className="quiz-option">
                  <input
                    type="radio"
                    name="symptom"
                    value={o.id}
                    checked={answers.symptom === o.id}
                    onChange={() => setAnswers({ ...answers, symptom: o.id })}
                  />
                  {o.label}
                </label>
              ))}
            </fieldset>

            <fieldset>
              <legend className="mono">Plinth-to-Street Differential Elevation</legend>
              {ELEVATION_OPTIONS.map((o) => (
                <label key={o.id} className="quiz-option">
                  <input
                    type="radio"
                    name="elevation"
                    value={o.id}
                    checked={answers.elevation === o.id}
                    onChange={() => setAnswers({ ...answers, elevation: o.id })}
                  />
                  {o.label}
                </label>
              ))}
            </fieldset>

            <button
              type="button"
              className="btn btn--primary"
              disabled={!allAnswered}
              onClick={() => setSubmitted(true)}
            >
              Compile evaluation
            </button>
          </div>
        ) : isCritical ? (
          <div className="critical-block">
            <pre className="mono critical-pre">
{`[ EVALUATION COMPILED: CRITICAL PROGRESSIVE SHEAR HAZARD WARNING ]
-----------------------------------------------------------------
DIAGNOSIS: Asset operating under active non-ductile joint fatigue compounded by chronic groundwater hydrostatic plinth destruction.
URGENCY THREAT LEVEL: MAXIMUM EXTREME METRIC.`}
            </pre>
            <a href={`tel:${tel}`} className="btn btn--threat" style={{ width: '100%', justifyContent: 'center', marginTop: '1.5rem' }}>
              Intercept Structural Crisis Direct Inbound Dial Now ({phone})
            </a>
          </div>
        ) : (
          <div className="panel quiz-result">
            <p className="mono result-intro">[ EVALUATION COMPILED: ELEVATED STRUCTURAL RISK PROFILE ]</p>
            <p style={{ color: 'var(--concrete)', marginBottom: '1.5rem' }}>
              Indicators suggest load-path or moisture ingress compromise requiring formal NDT verification. Submit contact telemetry for regional engineering review.
            </p>
            <form className="esc-form" onSubmit={handleLead}>
              <input
                type="text"
                placeholder="AUTHORIZED CONTACT NAME"
                required
                value={leadForm.name}
                onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
              />
              <input
                type="tel"
                placeholder="DIRECT INBOUND PHONE NUMBER"
                required
                value={leadForm.phone}
                onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
              />
              <input
                type="text"
                placeholder="GUWAHATI LOCALITY"
                required
                value={leadForm.loc}
                onChange={(e) => setLeadForm({ ...leadForm, loc: e.target.value })}
              />
              <MediaUploadField files={files} onChange={setFiles} label="Upload crack or leak photos (optional)" />
              {turnstileWidget}
              <button type="submit" className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }}>
                Transmit for field review
              </button>
              {error && <p className="form-note">{error}</p>}
            </form>
          </div>
        )}
      </div>
      <FormSuccessModal
        open={successOpen}
        message={successMessageText}
        onClose={() => setSuccessOpen(false)}
      />
    </section>
  );
}
