// core/systemStats.js
// Stats reais do processo/máquina, via módulo nativo 'os' do Node.
// Nunca inventa números: se algo não é medível (ex: VRAM sem GPU/driver
// acessível), retorna null e o frontend mostra "—" em vez de um valor falso.

const os = require('os');

let lastCpuSample = os.cpus();
let lastSampleTime = Date.now();

function cpuPercent() {
  const now = os.cpus();
  const elapsed = Date.now() - lastSampleTime;

  let idleDiff = 0;
  let totalDiff = 0;

  for (let i = 0; i < now.length; i++) {
    const prev = lastCpuSample[i]?.times;
    const curr = now[i].times;
    if (!prev) continue;
    const prevTotal = prev.user + prev.nice + prev.sys + prev.idle + prev.irq;
    const currTotal = curr.user + curr.nice + curr.sys + curr.idle + curr.irq;
    idleDiff += curr.idle - prev.idle;
    totalDiff += currTotal - prevTotal;
  }

  lastCpuSample = now;
  lastSampleTime = Date.now();

  if (totalDiff <= 0 || elapsed < 1) return null;
  const usage = 1 - idleDiff / totalDiff;
  return Math.max(0, Math.min(100, Math.round(usage * 100)));
}

function ramStats() {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  return {
    usedGB: +(usedBytes / (1024 ** 3)).toFixed(1),
    totalGB: +(totalBytes / (1024 ** 3)).toFixed(1),
  };
}

function get() {
  return {
    cpuPercent: cpuPercent(),
    ram: ramStats(),
    // VRAM não é medível de forma portátil sem ferramentas de GPU (nvidia-smi,
    // etc.), que geralmente não existem em Termux/Android. Melhor admitir isso
    // do que inventar um número.
    vram: null,
  };
}

module.exports = { get };
