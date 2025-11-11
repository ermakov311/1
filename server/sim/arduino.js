class ArduinoSimulator {
  constructor(onCircuitUpdate, onLog, netlist) {
    this.onCircuitUpdate = onCircuitUpdate;
    this.onLog = onLog;
    this.netlist = netlist || null;
    this.startTime = Date.now();
    this.pins = new Map();
    this.analogPins = new Map();
    this.modes = new Map();
    this.pwm = new Map();
    this.components = {}; // id -> state
  }

  notify() {
    if (this.onCircuitUpdate) this.onCircuitUpdate({ ...this.components });
  }

  pinMode(pin, mode) {
    this.modes.set(pin, mode);
  }

  digitalWrite(pin, value) {
    this.pins.set(pin, !!value);
    const before = this.millis();
    this.updateNetsForDigitalPin(pin, !!value);
    // Structured log for pin change
    try {
      const label = this.resolveArduinoPinLabel(pin);
      this.onLog && this.onLog({ type: 'event', name: 'digitalWrite', pin: label, value: !!value ? 1 : 0, ms: this.millis() });
    } catch {}
  }

  digitalRead(pin) {
    // If net contains a pressed button to Ground, read 0; otherwise 1 by default (pull-up like)
    if (this.netlist && this.netlist.arduinoId) {
      const label = this.resolveArduinoPinLabel(pin);
      const node = `${this.netlist.arduinoId}.${label}`;
      const group = this.netlist.flood(node);
      if (group && group.size) {
        let groundedViaButton = false;
        let vccViaButton = false;
        for (const entry of group) {
          const [compId] = entry.split('.');
          const comp = this.netlist.byId.get(compId);
          if (!comp) continue;
          const t = String(comp.type || '').toLowerCase();
          if (t.includes('button') && !!comp?.properties?.pressed) {
            // Check if button net also reaches ground
            const pins = comp?.pinPositions ? Object.keys(comp.pinPositions) : ['pin1','pin2'];
            for (const p of pins) {
              const g = this.netlist.flood(`${compId}.${p}`);
              if (this.netHasGround(g)) groundedViaButton = true;
              if (this.netHasVcc(g)) vccViaButton = true;
            }
          }
        }
        if (vccViaButton) return 1;
        if (groundedViaButton) return 0;
      }
    }
    return this.pins.get(pin) ? 1 : 1; // default HIGH (like pull-up)
  }

  analogWrite(pin, value) {
    const v = Math.max(0, Math.min(255, Number(value) || 0));
    this.pwm.set(pin, v);
    this.updateNetsForDigitalPin(pin, v > 127);
  }

  analogRead(pin) {
    return this.analogPins.get(pin) || 0;
  }

  delay(ms) {
    const t = Math.max(0, Number(ms) || 0);
    // Structured log for timing
    try { this.onLog && this.onLog({ type: 'event', name: 'delay', ms: t, at: this.millis() }); } catch {}
    return new Promise((resolve) => setTimeout(resolve, t));
  }

  millis() {
    return Date.now() - this.startTime;
  }

  serialPrint(msg) {
    this.onLog && this.onLog(String(msg));
  }

  getApi() {
    return {
      pinMode: this.pinMode.bind(this),
      digitalWrite: this.digitalWrite.bind(this),
      digitalRead: this.digitalRead.bind(this),
      analogWrite: this.analogWrite.bind(this),
      analogRead: this.analogRead.bind(this),
      delay: this.delay.bind(this),
      millis: this.millis.bind(this),
      Serial: { print: this.serialPrint.bind(this), println: (m) => this.serialPrint(String(m) + '\n') },
    };
  }

  dispose() {}
  dispose() {
    try {
      this.components = {};
      this.notify();
    } catch {}
  }

  // Map Arduino board pin -> net -> components, then mark LEDs in that net
  updateNetsForDigitalPin(pinNumber, high) {
    if (!this.netlist || !this.netlist.arduinoId) return;
    const label = this.resolveArduinoPinLabel(pinNumber);
    const node = `${this.netlist.arduinoId}.${label}`;
    const group = this.netlist.flood(node);
    if (!group || group.size === 0) return;
    // Mark LEDs that have a pin in this group as on/off
    const affected = [];
    for (const entry of group) {
      const [compId, pinName] = entry.split('.');
      const comp = this.netlist.byId.get(compId);
      if (!comp) continue;
      const type = (comp.type || '').toLowerCase();
      if (type.includes('led')) {
        // Require cathode net to be connected to ground-like pin
        const cathodePinName = Object.keys(comp.pinPositions || {}).find((p) => /cathode/i.test(p)) || 'cathode';
        let cathodeGround = false;
        try {
          const cathFlood = this.netlist.flood(`${compId}.${cathodePinName}`);
          cathodeGround = this.netHasGround(cathFlood);
        } catch {}
        const factor = this.computeBrightnessFactorForGroup(group);
        this.components[compId] = high && cathodeGround ? factor : 0; // 0..1 intensity
        affected.push(compId);
      }
    }
    if (this.onLog && affected.length) {
      // Emit per-LED events with brightness factor for verification
      const unique = [...new Set(affected)];
      for (const ledId of unique) {
        try {
          const intensity = this.components[ledId] || 0;
          this.onLog({ type: 'event', name: 'led', id: ledId, on: intensity > 0, brightness: intensity, ms: this.millis() });
        } catch {}
      }
    }
    this.notify();
  }

  computeBrightnessFactorForGroup(groupSet) {
    // Look for resistor(s) in the same net; use the maximum resistance found as limiting
    let resistance = 0;
    for (const entry of groupSet) {
      const [compId] = entry.split('.');
      const comp = this.netlist.byId.get(compId);
      if (!comp) continue;
      const type = (comp.type || '').toLowerCase();
      if (type.includes('resistor')) {
        const r = Number(comp?.properties?.resistance) || 0;
        if (r > resistance) resistance = r;
      }
    }
    // Simple mapping: brightness = 1 / (1 + R / 1000). Clamp 0..1
    const factor = 1 / (1 + resistance / 1000);
    return Math.max(0, Math.min(1, factor));
  }

  netHasGround(groupSet) {
    for (const entry of groupSet) {
      const [compId, pin] = entry.split('.');
      const comp = this.netlist.byId.get(compId);
      if (!comp) continue;
      const t = String(comp.type || '').toLowerCase();
      // Require explicit Ground component in the net
      if (t.includes('ground') || t === 'ground') return true;
    }
    return false;
  }

  netHasVcc(groupSet) {
    for (const entry of groupSet) {
      const [compId, pin] = entry.split('.');
      // treat Arduino 5V/3V3 pins as VCC sources
      if (/^(5v|3v3)$/i.test(pin)) return true;
    }
    return false;
  }

  resolveArduinoPinLabel(n) {
    // Map common digital pins: 0->TX0, 1->TX1, 2..12->D{n}, 13 fallback to nearest existing (D12)
    if (n === 0) return 'TX0';
    if (n === 1) return 'TX1';
    if (n >= 2 && n <= 12) return `D${n}`;
    return `D${n}`;
  }
}

module.exports = ArduinoSimulator;


