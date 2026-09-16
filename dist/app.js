const elements = {
  canvas: document.querySelector("#xr-canvas"),
  enterArButton: document.querySelector("#enter-ar-button"),
  exitArButton: document.querySelector("#exit-ar-button"),
  measurementControls: document.querySelector("#measurement-controls"),
  startButton: document.querySelector("#start-button"),
  stopButton: document.querySelector("#stop-button"),
  statusText: document.querySelector("#status-text"),
  statusBadge: document.querySelector("#status-badge"),
  statusLabel: document.querySelector("#status-label"),
  supportMessage: document.querySelector("#support-message"),
  distanceX: document.querySelector("#distance-x"),
  distanceY: document.querySelector("#distance-y"),
  distanceZ: document.querySelector("#distance-z"),
  distanceTotal: document.querySelector("#distance-total"),
};

const state = {
  session: null,
  referenceSpace: null,
  gl: null,
  latestPosition: null,
  startPosition: null,
  measuring: false,
  distances: { x: 0, y: 0, z: 0, total: 0 },
};

function formatDistance(value) {
  return Number.isFinite(value) ? value.toFixed(3) : "0.000";
}

function updateReadout(position) {
  if (!state.startPosition || !position) return;

  const x = Math.abs(position.x - state.startPosition.x);
  const y = Math.abs(position.y - state.startPosition.y);
  const z = Math.abs(position.z - state.startPosition.z);
  const total = Math.hypot(x, y, z);

  state.distances = { x, y, z, total };

  elements.distanceX.textContent = formatDistance(x);
  elements.distanceY.textContent = formatDistance(y);
  elements.distanceZ.textContent = formatDistance(z);
  elements.distanceTotal.textContent = formatDistance(total);
}

function resetReadout() {
  state.distances = { x: 0, y: 0, z: 0, total: 0 };
  elements.distanceX.textContent = "0.000";
  elements.distanceY.textContent = "0.000";
  elements.distanceZ.textContent = "0.000";
  elements.distanceTotal.textContent = "0.000";
}

function setStatus(text, label, active = false) {
  elements.statusText.textContent = text;
  elements.statusLabel.textContent = label;
  elements.statusBadge.classList.toggle("is-active", active);
}

function setSupportMessage(message, isError = false) {
  elements.supportMessage.textContent = message;
  elements.supportMessage.classList.toggle("is-error", isError);
}

function handleXRFrame(_time, frame) {
  const session = frame.session;
  session.requestAnimationFrame(handleXRFrame);

  const pose = frame.getViewerPose(state.referenceSpace);
  if (pose) {
    const { position } = pose.transform;
    state.latestPosition = { x: position.x, y: position.y, z: position.z };

    if (state.measuring) {
      updateReadout(state.latestPosition);
    }
  }

  const glLayer = session.renderState.baseLayer;
  state.gl.bindFramebuffer(state.gl.FRAMEBUFFER, glLayer.framebuffer);
  state.gl.clearColor(0, 0, 0, 0);
  state.gl.clear(state.gl.COLOR_BUFFER_BIT | state.gl.DEPTH_BUFFER_BIT);
}

function startMeasurement() {
  if (!state.latestPosition) {
    setSupportMessage("Position wird noch ermittelt. Bitte das Gerät kurz ruhig halten.", true);
    return;
  }

  state.startPosition = { ...state.latestPosition };
  state.measuring = true;
  resetReadout();
  elements.startButton.disabled = true;
  elements.stopButton.disabled = false;
  setStatus("Gerät zum Zielpunkt bewegen", "MISST", true);
  setSupportMessage("Die Distanz wird live vom gesetzten Startpunkt gemessen.");
}

function stopMeasurement() {
  if (!state.measuring) return;

  updateReadout(state.latestPosition);
  state.measuring = false;
  elements.startButton.disabled = false;
  elements.stopButton.disabled = true;
  setStatus("Ergebnis fixiert", "GESTOPPT");
  setSupportMessage("Messung beendet. Mit „Messung starten“ setzt du einen neuen Startpunkt.");
}

function registerWebMCPTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return;

  const noInputSchema = {
    type: "object",
    properties: {},
    additionalProperties: false,
  };

  const tools = [
    {
      name: "start_distance_measurement",
      title: "Distanzmessung starten",
      description:
        "Setzt die aktuelle Geräteposition als Startpunkt. Nur verwenden, wenn die AR-Sitzung bereits aktiv ist.",
      inputSchema: noInputSchema,
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute() {
        if (!state.session) throw new Error("Die AR-Sitzung ist nicht aktiv.");
        if (!state.latestPosition) throw new Error("Die Geräteposition ist noch nicht verfügbar.");
        startMeasurement();
        return { status: "measuring", unit: "meter" };
      },
    },
    {
      name: "stop_distance_measurement",
      title: "Distanzmessung stoppen",
      description: "Stoppt die aktive Messung und fixiert die vier sichtbaren Distanzwerte.",
      inputSchema: noInputSchema,
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute() {
        if (!state.measuring) throw new Error("Es läuft keine Messung.");
        stopMeasurement();
        return { status: "stopped", unit: "meter", ...state.distances };
      },
    },
    {
      name: "read_distance_measurement",
      title: "Distanzmessung auslesen",
      description: "Liest den aktuellen Messstatus und die vier sichtbaren Distanzwerte aus.",
      inputSchema: noInputSchema,
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() {
        return {
          status: state.measuring ? "measuring" : "stopped",
          unit: "meter",
          ...state.distances,
        };
      },
    },
  ];

  for (const tool of tools) {
    try {
      void Promise.resolve(context.registerTool(tool)).catch(console.error);
    } catch (error) {
      console.error(error);
    }
  }
}

async function endSession() {
  if (state.session) {
    await state.session.end();
  }
}

function handleSessionEnded() {
  state.session = null;
  state.referenceSpace = null;
  state.latestPosition = null;
  state.startPosition = null;
  state.measuring = false;

  document.body.classList.remove("xr-active");
  elements.enterArButton.classList.remove("is-hidden");
  elements.exitArButton.classList.add("is-hidden");
  elements.measurementControls.classList.add("is-hidden");
  elements.startButton.disabled = false;
  elements.stopButton.disabled = true;
  setStatus("Bereit für AR", "BEREIT");
  setSupportMessage("AR beendet. Die letzte Messung bleibt sichtbar.");
}

async function enterAR() {
  elements.enterArButton.disabled = true;
  setSupportMessage("AR wird gestartet …");

  try {
    const session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["local-floor", "dom-overlay"],
      domOverlay: { root: document.body },
    });

    const gl = elements.canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: false,
      xrCompatible: true,
    });

    if (!gl) {
      await session.end();
      throw new Error("WebGL konnte nicht initialisiert werden.");
    }

    await gl.makeXRCompatible();
    const referenceSpace = await session.requestReferenceSpace("local-floor");
    session.updateRenderState({
      baseLayer: new XRWebGLLayer(session, gl, { alpha: true }),
    });

    state.session = session;
    state.referenceSpace = referenceSpace;
    state.gl = gl;
    state.latestPosition = null;
    state.startPosition = null;
    state.measuring = false;

    session.addEventListener("end", handleSessionEnded, { once: true });
    document.body.classList.add("xr-active");
    elements.enterArButton.classList.add("is-hidden");
    elements.exitArButton.classList.remove("is-hidden");
    elements.measurementControls.classList.remove("is-hidden");
    elements.startButton.disabled = false;
    elements.stopButton.disabled = true;
    resetReadout();
    setStatus("Startpunkt setzen", "AR AKTIV", true);
    setSupportMessage("Kamera aktiv. Halte das Gerät ruhig und starte die Messung.");

    session.requestAnimationFrame(handleXRFrame);
  } catch (error) {
    console.error(error);
    elements.enterArButton.disabled = false;
    setStatus("AR konnte nicht starten", "FEHLER");
    setSupportMessage(
      "AR benötigt ein kompatibles Android-Gerät, Kamerazugriff und eine sichere HTTPS-Verbindung.",
      true,
    );
  }
}

async function checkXRSupport() {
  if (!window.isSecureContext) {
    setStatus("HTTPS erforderlich", "NICHT BEREIT");
    setSupportMessage("WebXR funktioniert nur über HTTPS oder auf localhost.", true);
    return;
  }

  if (!("xr" in navigator)) {
    setStatus("WebXR nicht verfügbar", "NICHT BEREIT");
    setSupportMessage("Öffne die App in einem WebXR-fähigen Browser auf einem AR-Gerät.", true);
    return;
  }

  try {
    const supported = await navigator.xr.isSessionSupported("immersive-ar");
    if (!supported) {
      setStatus("AR nicht unterstützt", "NICHT BEREIT");
      setSupportMessage("Dieses Gerät unterstützt keine immersive AR-Sitzung.", true);
      return;
    }

    elements.enterArButton.disabled = false;
    setSupportMessage("AR ist verfügbar. Beim Start wird Kamerazugriff angefragt.");
  } catch (error) {
    console.error(error);
    setStatus("AR-Prüfung fehlgeschlagen", "FEHLER");
    setSupportMessage("Die AR-Verfügbarkeit konnte nicht geprüft werden.", true);
  }
}

elements.enterArButton.addEventListener("click", enterAR);
elements.exitArButton.addEventListener("click", endSession);
elements.startButton.addEventListener("click", startMeasurement);
elements.stopButton.addEventListener("click", stopMeasurement);
document.body.addEventListener("beforexrselect", (event) => event.preventDefault());

registerWebMCPTools();
checkXRSupport();
