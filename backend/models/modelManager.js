// models/modelManager.js
// Nunca assume que um modelo esta instalado: escaneia o disco de verdade.

const fs = require('fs');
const path = require('path');
const { get: getSettings, update: updateSettings } = require('../core/settingsStore');

const MODELS_DIR = path.join(__dirname, '..', '..', 'models');

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function listLocalModels() {
  if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });
  const files = fs.readdirSync(MODELS_DIR).filter((f) => f.endsWith('.gguf'));
  const settings = getSettings();

  return files.map((filename) => {
    const stat = fs.statSync(path.join(MODELS_DIR, filename));
    return {
      id: filename,
      name: filename.replace(/\.gguf$/, ''),
      type: 'local',
      sizeBytes: stat.size,
      size: formatSize(stat.size),
      installed: true,
      selected: settings.ai.defaultModel === filename,
    };
  });
}

function selectModel(modelId) {
  const models = listLocalModels();
  const exists = models.find((m) => m.id === modelId);
  if (!exists) {
    throw new Error(`Modelo "${modelId}" nao encontrado em ${MODELS_DIR}`);
  }
  updateSettings({ ai: { defaultModel: modelId } });
  return exists;
}

module.exports = { listLocalModels, selectModel, MODELS_DIR };
