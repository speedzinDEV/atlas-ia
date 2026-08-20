// api/routes.js
const express = require('express');
const memoryStore = require('../memory/memoryStore');
const modelManager = require('../models/modelManager');
const settingsStore = require('../core/settingsStore');
const inference = require('../core/inference');
const systemStats = require('../core/systemStats');

const router = express.Router();

// ---------- status ----------
router.get('/', (req, res) => {
  res.json({ ok: true, message: 'Atlas está online' });
});

router.get('/health', async (req, res) => {
  const inferenceUp = await inference.isInferenceServerUp();
  res.json({
    ok: true,
    api: true,
    inferenceServer: inferenceUp,
    memory: true,
  });
});

router.get('/system/stats', (req, res) => {
  res.json({ ok: true, stats: systemStats.get() });
});

// ---------- chat (streaming via SSE) ----------
router.post('/chat', async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ ok: false, error: 'Campo "messages" é obrigatório.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  await inference.streamChat({
    messages,
    onToken: (token) => {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    },
    onDone: () => {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    },
    onError: (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    },
  });
});

// ---------- memory ----------
router.get('/memory', (req, res) => {
  res.json({ ok: true, entries: memoryStore.list() });
});

router.post('/memory', (req, res) => {
  try {
    const entry = memoryStore.add(req.body.text, req.body.origin || 'manual');
    res.status(201).json({ ok: true, entry });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.put('/memory/:id', (req, res) => {
  const entry = memoryStore.update(req.params.id, req.body.text || '');
  if (!entry) return res.status(404).json({ ok: false, error: 'Memória não encontrada.' });
  res.json({ ok: true, entry });
});

router.delete('/memory/:id', (req, res) => {
  const removed = memoryStore.remove(req.params.id);
  if (!removed) return res.status(404).json({ ok: false, error: 'Memória não encontrada.' });
  res.json({ ok: true });
});

// ---------- models ----------
router.get('/models', (req, res) => {
  res.json({ ok: true, local: modelManager.listLocalModels(), online: [] });
});

router.post('/models/select', (req, res) => {
  try {
    const model = modelManager.selectModel(req.body.modelId);
    res.json({ ok: true, model });
  } catch (err) {
    res.status(404).json({ ok: false, error: err.message });
  }
});

// ---------- settings ----------
router.get('/settings', (req, res) => {
  res.json({ ok: true, settings: settingsStore.get() });
});

router.post('/settings', (req, res) => {
  const settings = settingsStore.update(req.body || {});
  res.json({ ok: true, settings });
});

module.exports = router;
