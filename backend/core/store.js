// core/store.js
// Camada minima de persistencia em JSON. Sem banco externo: leve e portatil.
// Usada por memory, settings e conversations.

const fs = require('fs');
const path = require('path');

function ensureFile(filePath, defaultValue) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
  }
}

function readJson(filePath, defaultValue) {
  ensureFile(filePath, defaultValue);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    // Arquivo corrompido: nunca derruba o app, volta pro default e loga.
    console.error(`[store] falha ao ler ${filePath}:`, err.message);
    return defaultValue;
  }
}

function writeJson(filePath, value) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
  return value;
}

module.exports = { readJson, writeJson, ensureFile };
