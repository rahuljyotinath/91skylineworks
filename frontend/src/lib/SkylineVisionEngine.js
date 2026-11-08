const SkylineVisionEngine = {
  activeStream: null,
  capturedFrameBase64: null,
  refs: null,

  bind(refs) {
    this.refs = refs;
  },

  async bootScanner() {
    const { videoViewport, triggerLayout, systemHUD, hudFeedback } = this.refs;
    if (!videoViewport) return;

    try {
      this.activeStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      videoViewport.srcObject = this.activeStream;
      await videoViewport.play();

      if (systemHUD) systemHUD.style.display = 'block';
      if (triggerLayout) triggerLayout.style.display = 'none';
      this.dispatchHUDInstruction('initial', hudFeedback);
    } catch (fault) {
      console.error('Hardware video integration failed:', fault);
      if (hudFeedback) {
        hudFeedback.textContent = 'HARDWARE INTERFACE FAILURE. FALLBACK INITIATED.';
      }
    }
  },

  dispatchHUDInstruction(statusState, logNode) {
    const node = logNode || this.refs?.hudFeedback;
    if (!node) return;

    const actions = {
      initial: '[ STANDING BY // ALIGN STRUCTURAL CRACK OR SEEPAGE BOUNDARY WITHIN THE CENTER TARGET INDEX ]',
      'distance-error': '⚠️ SCAN DISTANCE FAULT: REPOSITION DEVICE 20CM BACK TO INTEGRATE EXTENDED LOAD PATH',
      'lumen-error': '⚠️ LUMINANCE ERROR: LOW ENVIRONMENT LUX INDEX. INTRODUCE EXTERNAL LIGHTING SOURCE',
      locked: '[ STRUCTURAL MATRIX LOCK CONFIRMED // CAPTURE TELEMETRY NOW ]',
    };

    const text = actions[statusState] || actions.initial;
    node.textContent = text;
    node.dataset.state = statusState;
  },

  async freezeAndCapture() {
    const video = this.refs?.videoViewport;
    if (!video) return null;

    const captureMatrix = document.createElement('canvas');
    captureMatrix.width = video.videoWidth || 1280;
    captureMatrix.height = video.videoHeight || 720;

    const context = captureMatrix.getContext('2d');
    context.drawImage(video, 0, 0, captureMatrix.width, captureMatrix.height);

    this.capturedFrameBase64 = captureMatrix.toDataURL('image/jpeg', 0.85);
    this.killStream();
    return this.capturedFrameBase64;
  },

  killStream() {
    if (this.activeStream) {
      this.activeStream.getTracks().forEach((track) => track.stop());
      this.activeStream = null;
    }
  },

  async executeDiagnosticProcessing(onLog) {
    const operationalLogs = [
      'Connecting to structural vision analysis core...',
      'Extracting capillary moisture variance patterns...',
      'Running structural crack geometry parsing algorithms...',
      'Mapping local Zone 5 seismic vulnerability indexes...',
    ];

    for (let i = 0; i < operationalLogs.length; i++) {
      onLog(operationalLogs[i]);
      await new Promise((r) => setTimeout(r, 700));
    }
  },

  async transmitTelemetry(base64Payload, turnstileToken = '') {
    try {
      const blob = await (async () => {
        const res = await fetch(base64Payload);
        return res.blob();
      })();

      const formData = new FormData();
      formData.append('image', blob, 'scan.jpg');
      if (turnstileToken) formData.append('cf-turnstile-response', turnstileToken);

      let serverResponse = await fetch('/api/diagnose', {
        method: 'POST',
        body: formData,
      });

      if (!serverResponse.ok) {
        serverResponse = await fetch('/api/diagnose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64Payload,
            ...(turnstileToken ? { 'cf-turnstile-response': turnstileToken } : {}),
          }),
        });
      }

      if (!serverResponse.ok) throw new Error('Network fault');

      const evaluation = await serverResponse.json();

      if (evaluation.isAmbiguous || !evaluation.severity) {
        return { type: 'escalation' };
      }

      return { type: 'result', evaluation };
    } catch (networkFault) {
      console.warn('Processing failed, escalating:', networkFault);
      return { type: 'escalation' };
    }
  },
};

export default SkylineVisionEngine;
