// core/settingsStore.js
const path = require('path');
const { readJson, writeJson } = require('./store');

const FILE = path.join(__dirname, '..', '..', 'data', 'settings', 'settings.json');

const DEFAULTS = {
  appearance: { theme: 'dark', animations: true },
  ai: {
    defaultModel: null,
    temperature: 0.7,
    contextSize: 4096,
    maxTokens: 512,
  },
  voice: { enabled: false, voice: 'default', speed: 1.0 },
  memory: { enabled: true },
  system: {
    apiPort: 3000,
    inferenceServerUrl: 'http://127.0.0.1:8080',
    logs: true,
  },
};

function get() {
  return readJson(FILE, DEFAULTS);
}

function update(partial) {
  const current = readJson(FILE, DEFAULTS);
  // merge raso por categoria (appearance, ai, voice, memory, system)
  const next = { ...current };
  for (const key of Object.keys(partial)) {
    next[key] = { ...(current[key] || {}), ...(partial[key] || {}) };
  }
  writeJson(FILE, next);
  return next;
}

module.exports = { get, update, DEFAULTS };
