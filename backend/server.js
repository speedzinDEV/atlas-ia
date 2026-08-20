// server.js - entrypoint do Atlas API
const express = require('express');
const cors = require('cors');
const routes = require('./api/routes');
const { get: getSettings } = require('./core/settingsStore');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/', routes);

const port = process.env.PORT || getSettings().system.apiPort || 3000;

app.listen(port, () => {
  console.log(`[Atlas API] rodando em http://127.0.0.1:${port}`);
});
