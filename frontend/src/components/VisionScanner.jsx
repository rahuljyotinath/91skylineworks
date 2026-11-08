import { useCallback, useEffect, useRef, useState } from 'react';
import SectionReveal from './SectionReveal';
import FormSuccessModal from './FormSuccessModal';
import MediaUploadField from './MediaUploadField';
import SkylineVisionEngine from '../lib/SkylineVisionEngine';
import { useFormTurnstile } from '../hooks/useFormTurnstile';
import { submitLead, successMessage } from '../lib/submitLead';
import { trackLead } from '../utils/analytics';
import './VisionScanner.css';

function DiagnosticResult({ evaluation, phone }) {
  const tel = phone?.replace(/[^0-9+]/g, '') || '+916003879490';
  const isHigh = evaluation.severity === 'High';

  return (
    <div className="diagnostic-result">
      <div className="mono result-tag">[ FORENSIC DIAGNOSTIC COMPILED SUCCESSFULLY ]</div>
      <h3>{evaluation.issueType}</h3>
      <div
        className="severity-badge mono"
        style={{
          background: isHigh ? 'var(--threat-bg)' : 'var(--panel)',
          color: isHigh ? 'var(--threat)' : 'var(--amber)',
        }}
      >
        STRUCTURAL THREAT PROFILE: {evaluation.severity}
      </div>
      <p className="result-analysis">{evaluation.analysis}</p>
      <div className="result-cta panel">
        <span className="mono cost-block">[!] COST CALCULATION RANGE BLOCKED UNDER LOCAL CODE RESTRICTIONS</span>
        <a href={`tel:${tel}`} className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }}>
          Unlock Preliminary Cost Estimates & Dispatch Field Inspector
        </a>
      </div>
    </div>
  );
}

function EscalationForm({ onSubmit, error }) {
  const [form, setForm] = useState({ name: '', phone: '', loc: '' });
  const [files, setFiles] = useState([]);
  const [localError, setLocalError] = useState(null);
  const { token: turnstileToken, assertReady, widget: turnstileWidget } = useFormTurnstile('escalation');

  return (
    <div className="escalation-form-wrap">
      <div className="mono esc-status">[ STATUS: MULTI-LAYER FAULT COMPLEXITY / IMAGE AMBIGUITY ]</div>
      <h3>Direct Structural Forensic Inspection Required</h3>
      <p className="esc-desc">
        The visual telemetry engine has flagged this defect pattern as an elevated risk. To rule out subterranean structural settlement or active load-path failure, this file must be reviewed manually by our engineering team.
      </p>
      <form
        className="esc-form"
        onSubmit={(e) => {
          e.preventDefault();
          setLocalError(null);
          try {
            assertReady();
            onSubmit(form, files, turnstileToken);
          } catch (err) {
            setLocalError(err.message);
          }
        }}
      >
        <input
          type="text"
          placeholder="AUTHORIZED CONTACT NAME"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          type="tel"
          placeholder="DIRECT INBOUND PHONE NUMBER"
          required
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <input
          type="text"
          placeholder="GUWAHATI LOCALITY (E.G., ZOO ROAD / GARCHUK)"
          required
          value={form.loc}
          onChange={(e) => setForm({ ...form, loc: e.target.value })}
        />
        <MediaUploadField files={files} onChange={setFiles} label="Attach scan photos or video (optional)" />
        {turnstileWidget}
        <button type="submit" className="btn btn--threat" style={{ width: '100%', justifyContent: 'center' }}>
          Transmit Structural Packets to Chief Diagnostics Officer
        </button>
        {(localError || error) && <p className="form-note">{localError || error}</p>}
      </form>
    </div>
  );
}

export default function VisionScanner({ contact }) {
  const videoRef = useRef(null);
  const [phase, setPhase] = useState('idle');
  const [logs, setLogs] = useState('');
  const [output, setOutput] = useState(null);
  const [escError, setEscError] = useState(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMessageText, setSuccessMessageText] = useState('');
  const hudRef = useRef(null);
  const {
    token: scanTurnstileToken,
    required: scanTurnstileRequired,
    assertReady: assertScanTurnstile,
    reset: resetScanTurnstile,
    widget: scanTurnstileWidget,
  } = useFormTurnstile('diagnose');
  const [scanGateError, setScanGateError] = useState(null);

  useEffect(() => {
    SkylineVisionEngine.bind({
      videoViewport: videoRef.current,
      triggerLayout: document.getElementById('scanner-init-trigger'),
      systemHUD: document.getElementById('terminal-hud-overlay'),
      hudFeedback: hudRef.current,
    });
    return () => SkylineVisionEngine.killStream();
  }, []);

  const boot = () => {
    SkylineVisionEngine.bind({
      videoViewport: videoRef.current,
      triggerLayout: document.getElementById('scanner-init-trigger'),
      systemHUD: document.getElementById('terminal-hud-overlay'),
      hudFeedback: hudRef.current,
    });
    SkylineVisionEngine.bootScanner();
    setPhase('live');
  };

  const capture = useCallback(async () => {
    setScanGateError(null);
    try {
      assertScanTurnstile();
    } catch (err) {
      setScanGateError(err.message);
      return;
    }
    setPhase('processing');
    setLogs('');
    const frame = await SkylineVisionEngine.freezeAndCapture();
    if (!frame) {
      setOutput({ type: 'escalation' });
      setPhase('done');
      return;
    }

    await SkylineVisionEngine.executeDiagnosticProcessing((line) => {
      setLogs((prev) => `${prev}\n> ${line}`);
    });

    const result = await SkylineVisionEngine.transmitTelemetry(frame, scanTurnstileToken);
    if (scanTurnstileRequired) resetScanTurnstile();
    setOutput(result);
    setPhase('done');
  }, [assertScanTurnstile, scanTurnstileToken, scanTurnstileRequired, resetScanTurnstile]);

  const handleEscalation = async (form, files, turnstileToken) => {
    setEscError(null);
    try {
      const data = await submitLead({
        name: form.name,
        phone: form.phone,
        locality: form.loc,
        source: 'escalation',
        files,
        turnstileToken,
      });
      const firstName = form.name.trim().split(' ')[0];
      setSuccessMessageText(successMessage(data, firstName));
      setSuccessOpen(true);
      trackLead('analyzer');
      setOutput(null);
      setPhase('idle');
    } catch (err) {
      setEscError(err.message);
    }
  };

  return (
    <section id="analyzer">
      <div className="wrap">
        <SectionReveal className="section-head">
          <span className="eyebrow">Multi-Modal Analyzer</span>
          <h2>Structural camera scan engine.</h2>
        </SectionReveal>

        <div className="vision-scanner panel">
          <div className="vision-viewport-wrap">
            <video
              ref={videoRef}
              id="vision-viewport"
              className="vision-viewport"
              playsInline
              autoPlay
              muted
            />
            <div id="terminal-hud-overlay" className="hud-overlay" style={{ display: 'none' }}>
              <div className="hud-crosshair" />
              <p ref={hudRef} id="hud-feedback-string" className="mono hud-feedback" />
            </div>
          </div>

          <div className="vision-controls">
            <button
              type="button"
              id="scanner-init-trigger"
              className="btn btn--primary"
              onClick={boot}
            >
              [ ACTIVATE HARDWARE SCANNER ]
            </button>
            {phase === 'live' && (
              <button type="button" className="btn btn--ghost" onClick={capture}>
                [ CAPTURE TELEMETRY ]
              </button>
            )}
          </div>
          {(phase === 'live' || phase === 'idle') && scanTurnstileWidget}
          {scanGateError && <p className="form-error">{scanGateError}</p>}

          {phase === 'processing' && (
            <pre id="terminal-logger-console" className="terminal-logger mono">
              {logs || '> Initializing diagnostic pipeline...'}
            </pre>
          )}

          <div id="diagnostic-output-container" className="diagnostic-output-container">
            {output?.type === 'result' && (
              <DiagnosticResult evaluation={output.evaluation} phone={contact?.phone} />
            )}
            {output?.type === 'escalation' && (
              <EscalationForm onSubmit={handleEscalation} error={escError} />
            )}
          </div>
        </div>
      </div>
      <FormSuccessModal
        open={successOpen}
        message={successMessageText}
        onClose={() => setSuccessOpen(false)}
      />
    </section>
  );
}
