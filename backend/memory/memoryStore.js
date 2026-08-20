// memory/memoryStore.js
// Memoria do Atlas: fatos curtos que o usuario permitiu guardar.
// Cada entrada tem id, texto, origem (manual|auto) e data.

const path = require('path');
const crypto = require('crypto');
const { readJson, writeJson } = require('../core/store');

const FILE = path.join(__dirname, '..', '..', 'data', 'memory', 'memory.json');

function list() {
  return readJson(FILE, { entries: [] }).entries;
}

function add(text, origin = 'manual') {
  if (!text || !text.trim()) {
    throw new Error('Texto da memoria nao pode ser vazio');
  }
  const data = readJson(FILE, { entries: [] });
  const entry = {
    id: crypto.randomUUID(),
    text: text.trim(),
    origin,
    createdAt: new Date().toISOString(),
  };
  data.entries.push(entry);
  writeJson(FILE, data);
  return entry;
}

function update(id, text) {
  const data = readJson(FILE, { entries: [] });
  const entry = data.entries.find((e) => e.id === id);
  if (!entry) return null;
  entry.text = text.trim();
  entry.updatedAt = new Date().toISOString();
  writeJson(FILE, data);
  return entry;
}

function remove(id) {
  const data = readJson(FILE, { entries: [] });
  const before = data.entries.length;
  data.entries = data.entries.filter((e) => e.id !== id);
  writeJson(FILE, data);
  return data.entries.length < before;
}

module.exports = { list, add, update, remove };
