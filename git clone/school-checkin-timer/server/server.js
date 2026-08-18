const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const APP_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data', 'classes');
const DEFAULT_CONFIG = path.join(APP_ROOT, 'data', 'tasks.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(express.static(APP_ROOT, { extensions: ['html'] }));

function safeClassId(value) {
  const classId = String(value || '').trim();
  if (!/^[0-9A-Za-z_-]{1,32}$/.test(classId)) return null;
  return classId;
}

function configPath(classId) {
  return path.join(DATA_DIR, `${classId}.json`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readConfig(classId) {
  const savedPath = configPath(classId);
  if (fs.existsSync(savedPath)) return readJson(savedPath);
  const fallback = readJson(DEFAULT_CONFIG);
  return { ...fallback, classId };
}

function validateConfig(input, classId) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.tasks)) {
    return { ok: false, message: '設定データが正しくありません。' };
  }
  if (input.tasks.length > 30) {
    return { ok: false, message: 'タスクは30件以内にしてください。' };
  }
  const tasks = input.tasks.map((task, index) => ({
    id: String(task.id || `task-${index + 1}`).slice(0, 80),
    label: String(task.label || 'やること').slice(0, 40),
    icon: String(task.icon || '⭐').slice(0, 8),
    minutes: Math.min(60, Math.max(1, Number(task.minutes) || 1)),
    enabled: task.enabled !== false,
    accent: String(task.accent || 'blue').slice(0, 16)
  }));
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  return {
    ok: true,
    config: {
      classId,
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(input.date || '')) ? input.date : new Date().toISOString().slice(0, 10),
      version: Math.max(1, Number(input.version) || 1),
      mode: input.mode === 'high' ? 'high' : 'low',
      startTime: timePattern.test(String(input.startTime || '')) ? input.startTime : '08:15',
      endTime: timePattern.test(String(input.endTime || '')) ? input.endTime : '08:30',
      updatedAt: new Date().toISOString(),
      tasks
    }
  };
}

function writeConfig(classId, config) {
  const target = configPath(classId);
  const temp = `${target}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, target);
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'school-checkin-timer', now: new Date().toISOString() });
});

app.get('/api/time', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ now: Date.now(), iso: new Date().toISOString() });
});

app.get('/api/classes/:classId/today', (req, res) => {
  const classId = safeClassId(req.params.classId);
  if (!classId) return res.status(400).json({ error: 'invalid_class_id' });
  try {
    res.set('Cache-Control', 'no-store');
    return res.json(readConfig(classId));
  } catch (error) {
    console.error('read config failed', error);
    return res.status(500).json({ error: 'read_failed' });
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const clientsByClass = new Map();

function roomFor(classId) {
  if (!clientsByClass.has(classId)) clientsByClass.set(classId, new Set());
  return clientsByClass.get(classId);
}

function broadcast(classId, message) {
  const payload = JSON.stringify(message);
  for (const client of roomFor(classId)) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

app.post('/api/classes/:classId/config', (req, res) => {
  const classId = safeClassId(req.params.classId);
  if (!classId) return res.status(400).json({ error: 'invalid_class_id' });
  const checked = validateConfig(req.body, classId);
  if (!checked.ok) return res.status(400).json({ error: 'invalid_config', message: checked.message });
  try {
    writeConfig(classId, checked.config);
    broadcast(classId, { type: 'config-published', config: checked.config });
    return res.json({ ok: true, config: checked.config, connected: roomFor(classId).size });
  } catch (error) {
    console.error('write config failed', error);
    return res.status(500).json({ error: 'write_failed' });
  }
});

wss.on('connection', (socket, request) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const classId = safeClassId(url.searchParams.get('classId'));
  if (!classId) {
    socket.close(1008, 'classId required');
    return;
  }
  const room = roomFor(classId);
  room.add(socket);
  socket.send(JSON.stringify({ type: 'hello', classId, connected: room.size, serverTime: Date.now() }));
  broadcast(classId, { type: 'presence', connected: room.size });

  socket.on('message', raw => {
    try {
      const message = JSON.parse(String(raw));
      if (message.type === 'config-ack') {
        broadcast(classId, {
          type: 'config-ack',
          classId,
          version: Number(message.version) || 0,
          deviceId: String(message.deviceId || 'unknown').slice(0, 64)
        });
      }
    } catch (_) {}
  });

  socket.on('close', () => {
    room.delete(socket);
    if (room.size === 0) clientsByClass.delete(classId);
    else broadcast(classId, { type: 'presence', connected: room.size });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`School Check-in Timer: http://localhost:${PORT}`);
  console.log(`LAN: http://<teacher-pc-ip>:${PORT}`);
});
