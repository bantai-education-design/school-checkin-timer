(() => {
  const STORAGE_KEY = 'school-checkin:published-config';
  const DEVICE_KEY = 'school-checkin:device-id';
  const CHANNEL_NAME = 'school-checkin-config';
  const state = { config: null, completed: new Set(), socket: null, reconnectTimer: null };

  const grid = document.getElementById('task-grid');
  const doneEl = document.getElementById('task-done');
  const totalEl = document.getElementById('task-total');
  const startLabel = document.getElementById('start-time-label');
  const endLabel = document.getElementById('end-time-label');
  const syncStatus = document.getElementById('sync-status');
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;

  function safe(value) {
    return String(value ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c] || c));
  }

  function deviceId() {
    let value = localStorage.getItem(DEVICE_KEY);
    if (!value) {
      value = `device-${Math.random().toString(36).slice(2,10)}`;
      localStorage.setItem(DEVICE_KEY, value);
    }
    return value;
  }

  function paintProgress() {
    const activeTasks = (state.config?.tasks || []).filter(task => task.enabled);
    const done = activeTasks.filter(task => state.completed.has(task.id)).length;
    doneEl.textContent = String(done);
    totalEl.textContent = String(activeTasks.length);
  }

  function makeTaskCard(task) {
    const button = document.createElement('button');
    button.className = `task-card task-${task.accent || 'blue'}`;
    button.type = 'button';
    button.dataset.taskId = task.id;
    const isDone = state.completed.has(task.id);
    button.classList.toggle('done', isDone);
    button.setAttribute('aria-pressed', isDone ? 'true' : 'false');
    button.innerHTML = `
      <span class="task-icon">${safe(task.icon || '⭐')}</span>
      <span class="task-copy">
        <span class="task-label">${safe(task.label)}</span>
        <small>${Math.max(1, Number(task.minutes) || 1)}ぷん</small>
      </span>
      <span class="task-check">✓</span>`;
    button.addEventListener('click', () => {
      if (state.completed.has(task.id)) state.completed.delete(task.id);
      else state.completed.add(task.id);
      button.classList.toggle('done', state.completed.has(task.id));
      button.setAttribute('aria-pressed', state.completed.has(task.id) ? 'true' : 'false');
      paintProgress();
    });
    return button;
  }

  function render(config, source = 'local') {
    const activeIds = new Set((config.tasks || []).map(task => task.id));
    state.completed = new Set([...state.completed].filter(id => activeIds.has(id)));
    state.config = config;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    grid.innerHTML = '';
    config.tasks.filter(task => task.enabled).forEach(task => grid.appendChild(makeTaskCard(task)));
    startLabel.textContent = `${config.startTime} スタート`;
    endLabel.textContent = `${config.endTime} あさのかい`;
    document.documentElement.dataset.gradeMode = config.mode || 'low';
    paintProgress();
    if (syncStatus) {
      syncStatus.textContent = source === 'teacher' ? 'せんせいの へんこうを うけとりました' : 'このたんまつは じゅんびOK';
      if (source === 'teacher') setTimeout(() => { if (syncStatus.textContent.includes('へんこう')) syncStatus.textContent = 'せんせいと つながっています'; }, 3500);
    }
    window.dispatchEvent(new CustomEvent('morning-config-loaded', { detail: config }));
  }

  function ack(version) {
    if (state.socket?.readyState === WebSocket.OPEN) {
      state.socket.send(JSON.stringify({ type: 'config-ack', version, deviceId: deviceId() }));
    }
  }

  function connectSocket(classId) {
    if (!/^https?:$/.test(location.protocol)) return;
    clearTimeout(state.reconnectTimer);
    if (state.socket) {
      state.socket.onclose = null;
      state.socket.close();
    }
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/ws?classId=${encodeURIComponent(classId)}`);
    state.socket = socket;
    socket.onopen = () => { if (syncStatus) syncStatus.textContent = 'せんせいと つながっています'; };
    socket.onmessage = event => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'config-published' && message.config) {
          render(message.config, 'teacher');
          ack(message.config.version);
        } else if (message.type === 'hello' && syncStatus) {
          syncStatus.textContent = 'せんせいと つながっています';
        }
      } catch (_) {}
    };
    socket.onclose = () => {
      if (syncStatus) syncStatus.textContent = 'つなぎなおしています…';
      state.reconnectTimer = setTimeout(() => connectSocket(classId), 3000);
    };
    socket.onerror = () => socket.close();
  }

  function readStored() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) { return null; }
  }

  async function load() {
    const stored = readStored();
    const classId = stored?.classId || '1-1';
    let config = null;
    try {
      const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/today`, { cache: 'no-store' });
      if (response.ok) config = await response.json();
    } catch (_) {}
    if (!config && stored) config = stored;
    if (!config) {
      try {
        const response = await fetch('data/tasks.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        config = await response.json();
      } catch (error) {
        console.error('Task config load failed:', error);
        if (syncStatus) syncStatus.textContent = 'せっていを よみこめませんでした';
        return;
      }
    }
    render(config, 'local');
    connectSocket(config.classId || classId);
  }

  channel?.addEventListener('message', event => {
    if (event.data?.type !== 'config-published' || !event.data.config) return;
    const previousClass = state.config?.classId;
    render(event.data.config, 'teacher');
    if (event.data.config.classId && event.data.config.classId !== previousClass) connectSocket(event.data.config.classId);
  });
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try { render(JSON.parse(event.newValue), 'teacher'); } catch (_) {}
  });

  window.MorningTasks = { load, render };
  load();
})();
