const http = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Arduino = require('./sim/arduino');

const PORT = process.env.SIM_PORT || 4000;

const server = http.createServer();
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

let uploadedCode = null;
let simulator = null;
let loopInterval = null;
let netlist = null; // built from project

function buildNetlist(project) {
  if (!project) return null;
  const { components = [], wires = [] } = project;
  // Build adjacency by node "compId.pinName"
  const adj = new Map();
  function addEdge(a, b) {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b);
    adj.get(b).add(a);
  }
  for (const w of wires) {
    const a = `${w.start.componentId}.${w.start.pinName}`;
    const b = `${w.end.componentId}.${w.end.pinName}`;
    addEdge(a, b);
  }
  // Treat resistors as conductive two-terminal devices for traversal (series elements allowed)
  for (const comp of components) {
    const type = String(comp.type || '').toLowerCase();
    if (type.includes('resistor')) {
      const pins = comp?.pinPositions ? Object.keys(comp.pinPositions) : ['pin1', 'pin2'];
      if (pins.length >= 2) {
        addEdge(`${comp.id}.${pins[0]}`, `${comp.id}.${pins[1]}`);
      }
    }
  }
  // Helper to find all nodes connected to a node
  function flood(start) {
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const n = stack.pop();
      for (const m of (adj.get(n) || [])) if (!seen.has(m)) { seen.add(m); stack.push(m); }
    }
    return seen;
  }
  // Index components by id
  const byId = new Map(components.map((c) => [c.id, c]));
  // Find Arduino component id
  const arduino = components.find((c) => (c.type || '').toLowerCase().includes('arduino')) || null;
  return { adj, flood, byId, arduinoId: arduino ? arduino.id : null };
}

function transpileIfArduinoC(code) {
  try {
    let src = String(code).replace(/\r\n/g, '\n');
    const hasCpp = /\bvoid\s+setup\s*\(\)\s*\{|\bvoid\s+loop\s*\(\)\s*\{/m.test(src);
    if (!hasCpp) return code; // already JS
    // Strip C/C++ comments
    src = src.replace(/\/\*[\s\S]*?\*\//g, '');
    src = src.replace(/(^|\n)\s*\/\/.*(?=\n|$)/g, '$1');

    function extractBody(source, funcName) {
      const sig = new RegExp(`\\bvoid\\s+${funcName}\\s*\\(\\)\\s*\\{`, 'm');
      const m = source.match(sig);
      if (!m) return '';
      let i = m.index + m[0].length;
      let depth = 1;
      while (i < source.length && depth > 0) {
        const ch = source[i++];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
      }
      const body = source.slice(m.index + m[0].length, i - 1);
      return body;
    }

    const setupRaw = extractBody(src, 'setup');
    const loopRaw = extractBody(src, 'loop');

    // Collect global declarations from the rest (outside functions)
    let preSrc = src;
    preSrc = preSrc.replace(/\bvoid\s+setup\s*\(\)\s*\{[\s\S]*?\}/m, '');
    preSrc = preSrc.replace(/\bvoid\s+loop\s*\(\)\s*\{[\s\S]*?\}/m, '');
    const declRegex = /(^|\n)\s*(?:const\s+)?(?:unsigned\s+)?(?:long\s+|short\s+)?(?:byte|bool|int|long|short|float|double)\s+([A-Za-z_]\w*)(\s*=\s*[^;]+)?\s*;/g;
    let match;
    const prelude = [];
    while ((match = declRegex.exec(preSrc)) !== null) {
      const name = match[2];
      const init = match[3] ? match[3].replace(/^\s*=\s*/, ' = ') : '';
      prelude.push(`let ${name}${init};`);
    }

    const replaceTypesWithLet = (s) => s.replace(/(^|\n)\s*(?:const\s+)?(?:unsigned\s+)?(?:long\s+|short\s+)?(?:byte|bool|int|long|short|float|double)\s+([A-Za-z_]\w*)(\s*=\s*[^;]+)?\s*;/g, (_m, p1, name, init) => {
      const rhs = init ? init.replace(/^\s*=\s*/, ' = ') : '';
      return `${p1}let ${name}${rhs};`;
    });
    const toJs = (body) => replaceTypesWithLet(body)
      // Convert C-style typed for-loop init: for (int i = 0; ...)
      .replace(/for\s*\(\s*(?:const\s+)?(?:unsigned\s+)?(?:long\s+|short\s+)?(?:byte|bool|int|long|short|float|double)\s+([A-Za-z_]\w*)\s*=/g, 'for (let $1 =')
      .replace(/\bHIGH\b/g, '1')
      .replace(/\bLOW\b/g, '0')
      .replace(/\bOUTPUT\b/g, '1')
      .replace(/\bINPUT\b/g, '0')
      .replace(/\bpinMode\s*\(/g, 'Arduino.pinMode(')
      .replace(/\bdigitalWrite\s*\(/g, 'Arduino.digitalWrite(')
      .replace(/\banalogWrite\s*\(/g, 'Arduino.analogWrite(')
      .replace(/\bdigitalRead\s*\(/g, 'Arduino.digitalRead(')
      .replace(/\banalogRead\s*\(/g, 'Arduino.analogRead(')
      .replace(/\bdelay\s*\(/g, 'await Arduino.delay(')
      .replace(/\bmillis\s*\(/g, 'Arduino.millis(');

    const setupBody = toJs(setupRaw);
    const loopBody = toJs(loopRaw);
    const pre = prelude.length ? prelude.join('\n') + '\n' : '';
    return `${pre}async function setup(){${setupBody}}\nasync function loop(){${loopBody}}`;
  } catch { return code; }
}

function emitCircuit(ioOrSocket, state) {
  ioOrSocket.emit('circuitUpdate', { components: state });
}

function compileWithArduinoCli(code, cb) {
  // Requires arduino-cli installed and configured in PATH
  if ((process.env.USE_MOCK_COMPILE || '').toLowerCase() === 'true') {
    return cb({ success: true, errors: [] });
  }
  let tmpDir;
  try {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arduino-sim-'));
    const sketchDir = path.join(tmpDir, 'sketch');
    fs.mkdirSync(sketchDir);
    const sketchFile = path.join(sketchDir, 'sketch.ino');
    fs.writeFileSync(sketchFile, code);

    let cli = process.env.ARDUINO_CLI_PATH || 'arduino-cli';
    // Prefer bundled CLI if present: src/arduino/arduino-cli.exe (Windows) or without .exe (others)
    const bundledWin = path.resolve(__dirname, '..', 'src', 'arduino', 'arduino-cli.exe');
    const bundledUnix = path.resolve(__dirname, '..', 'src', 'arduino', 'arduino-cli');
    try {
      if (process.platform === 'win32' && fs.existsSync(bundledWin)) {
        cli = bundledWin;
      } else if (fs.existsSync(bundledUnix)) {
        cli = bundledUnix;
      }
    } catch {}
    // Windows common install locations auto-detect
    if (process.platform === 'win32' && (!process.env.ARDUINO_CLI_PATH)) {
      const candidates = [
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Arduino CLI', 'arduino-cli.exe'),
        path.join('C:', 'Program Files', 'Arduino CLI', 'arduino-cli.exe'),
        path.join('C:', 'Program Files (x86)', 'Arduino CLI', 'arduino-cli.exe'),
      ];
      for (const p of candidates) {
        try { if (fs.existsSync(p)) { cli = p; break; } } catch {}
      }
    }
    const args = ['compile', '--fqbn', 'arduino:avr:uno', sketchDir];
    const child = spawn(cli, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    let stdout = '';
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.on('error', (err) => {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      cb({ success: false, errors: [
        `Failed to spawn ${cli}. Make sure Arduino CLI is installed and in PATH, or set ARDUINO_CLI_PATH.`,
        String(err && err.message ? err.message : err)
      ]});
    });
    child.on('close', (codeExit) => {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      const success = codeExit === 0;
      const errors = success ? [] : (stderr || stdout).split('\n').filter(Boolean);
      cb({ success, errors });
    });
  } catch (e) {
    try { if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    cb({ success: false, errors: ['arduino-cli not available or failed', String(e.message || e)] });
  }
}

io.on('connection', (socket) => {
  console.log('client connected', socket.id);
  socket.on('compileCode', ({ code }) => {
    if (!code) return socket.emit('compilationResult', { success: false, errors: ['Empty code'] });
    compileWithArduinoCli(code, (result) => {
      socket.emit('compilationResult', result);
    });
  });

  socket.on('uploadCode', ({ code }) => {
    try {
      // Защита от слишком больших файлов кода (максимум 1MB)
      const MAX_CODE_SIZE = 1024 * 1024; // 1MB
      if (code && typeof code === 'string' && code.length > MAX_CODE_SIZE) {
        console.warn(`[SERVER] uploadCode rejected: code too large (${code.length} bytes)`);
        return socket.emit('uploadAck', { ok: false, error: 'Code too large (max 1MB)' });
      }
      uploadedCode = code || null;
      console.log('uploadCode received, size:', code ? code.length : 0);
      socket.emit('uploadAck', { ok: true });
    } catch (error) {
      console.error('[SERVER] uploadCode error:', error);
      try {
        socket.emit('uploadAck', { ok: false, error: error.message || 'Upload failed' });
      } catch (emitError) {
        console.error('[SERVER] Failed to emit uploadAck error:', emitError);
      }
    }
  });

  socket.on('startSimulation', ({ project } = {}) => {
    try {
      // Защита от слишком больших проектов (максимум 1000 компонентов)
      if (project && project.components && Array.isArray(project.components) && project.components.length > 1000) {
        console.warn(`[SERVER] startSimulation rejected: too many components (${project.components.length})`);
        return socket.emit('simulationOutput', { type: 'log', message: 'Too many components (max 1000)' });
      }
      if (!uploadedCode) return socket.emit('simulationOutput', { type: 'log', message: 'No code uploaded' });
      if (simulator) return; // already running
      netlist = buildNetlist(project);
      console.log('startSimulation, netlist built with', project?.components?.length || 0, 'components');
    simulator = new Arduino(
      (update) => emitCircuit(io, update),
      (msg) => io.emit('simulationOutput', { type: 'log', message: msg }),
      netlist
    );

    io.emit('simulationStarted', {});

    // Very naive runner: expects user code with setup() and loop() in JS-like form
    let user = null;
    try {
      // sandboxed function receiving arduino API
      const api = simulator.getApi();
      const jsCode = transpileIfArduinoC(uploadedCode);
      console.log('--- Transpiled JS start ---\n' + jsCode + '\n--- Transpiled JS end ---');
      const fn = new Function('Arduino', `${jsCode}; return { setup: typeof setup==='function'?setup:()=>{}, loop: typeof loop==='function'?loop:()=>{} };`);
      user = fn(api);
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      console.error('User code build error:', msg, e && e.stack ? '\n' + e.stack : '');
      io.emit('simulationOutput', { type: 'log', message: 'User code error: ' + msg });
      io.emit('simulationOutput', { type: 'log', message: 'Посмотри логи сервера: показан транспилированный JS.' });
      simulator = null;
      return;
    }

    try {
      const r = user.setup();
      if (r && typeof r.then === 'function') {
        r.catch((e) => io.emit('simulationOutput', { type: 'log', message: 'setup() error: ' + (e.message || String(e)) }));
      }
    } catch (e) {
      io.emit('simulationOutput', { type: 'log', message: 'setup() error: ' + (e.message || String(e)) });
    }

    const runLoop = () => {
      if (!simulator) return;
      try {
        // Mark start of a loop iteration for deterministic verification
        try { io.emit('simulationOutput', { type: 'event', name: 'loop', phase: 'start', ms: Date.now() }); } catch {}
        const pr = user.loop();
        if (pr && typeof pr.then === 'function') {
          pr.then(() => {
            try { io.emit('simulationOutput', { type: 'event', name: 'loop', phase: 'end', ms: Date.now() }); } catch {}
            setTimeout(runLoop, 0);
          }).catch((e) => {
            io.emit('simulationOutput', { type: 'log', message: 'loop() error: ' + (e.message || String(e)) });
            try { io.emit('simulationOutput', { type: 'event', name: 'loop', phase: 'end', ms: Date.now() }); } catch {}
            setTimeout(runLoop, 0);
          });
          return;
        }
        try { io.emit('simulationOutput', { type: 'event', name: 'loop', phase: 'end', ms: Date.now() }); } catch {}
        setTimeout(runLoop, 0);
      } catch (e) {
        io.emit('simulationOutput', { type: 'log', message: 'loop() error: ' + (e.message || String(e)) });
        try { io.emit('simulationOutput', { type: 'event', name: 'loop', phase: 'end', ms: Date.now() }); } catch {}
        setTimeout(runLoop, 0);
      }
    };
    runLoop();
    } catch (error) {
      console.error('[SERVER] startSimulation error:', error);
      try {
        socket.emit('simulationOutput', { type: 'log', message: 'Simulation start error: ' + (error.message || String(error)) });
      } catch (emitError) {
        console.error('[SERVER] Failed to emit simulation error:', emitError);
      }
    }
  });

  socket.on('stopSimulation', () => {
    loopInterval = null;
    if (simulator) simulator.dispose();
    simulator = null;
    io.emit('simulationFinished', {});
    // Clear client circuit state
    io.emit('circuitUpdate', { components: {} });
  });

  socket.on('updateComponent', ({ id, properties } = {}) => {
    try {
      if (!netlist) return;
      const comp = netlist.byId.get(id);
      if (!comp) return;
      comp.properties = Object.assign({}, comp.properties || {}, properties || {});
      // Emit meaningful event logs for buttons
      const t = String(comp.type || '').toLowerCase();
      if (t.includes('button') && Object.prototype.hasOwnProperty.call(properties || {}, 'pressed')) {
        io.emit('simulationOutput', {
          type: 'event',
          name: 'button',
          id,
          pressed: !!properties.pressed,
          ts: Date.now(),
        });
      }
    } catch {}
  });
});

// Глобальная обработка необработанных ошибок для предотвращения падения сервера
process.on('uncaughtException', (error) => {
  console.error('[SERVER] Uncaught Exception:', error);
  // Не завершаем процесс, чтобы сервер продолжал работать
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[SERVER] Unhandled Rejection at:', promise, 'reason:', reason);
  // Не завершаем процесс, чтобы сервер продолжал работать
});

server.listen(PORT, () => {
  console.log('Simulator server listening on', PORT);
});


