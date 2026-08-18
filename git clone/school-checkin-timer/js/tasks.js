(() => {
  const STORAGE_KEY = 'school-checkin:published-config';
  const CHANNEL_NAME = 'school-checkin-config';
  const state = { config: null, completed: new Set() };

  const grid = document.getElementById('task-grid');
  const doneEl = document.getElementById('task-done');
  const totalEl = document.getElementById('task-total');
  const startLabel = document.getElementById('start-time-label');
  const endLabel = document.getElementById('end-time-label');
  const syncStatus = document.getElementById('sync-status');

  function paintProgress() {
    const activeTasks = (state.config?.tasks || []).filter((task) => task.enabled);
    const done = activeTasks.filter((task) => state.completed.has(task.id)).length;
    doneEl.textContent = String(done);
    totalEl.textContent = String(activeTasks.length);
  }

  function safe(value) {
    return String(value ?? '').replace(/[&<>\"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c] || c));
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
      <span class="task-check">✓</span>
    `;

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
    const activeIds = new Set((config.tasks || []).map((task) => task.id));
    state.completed = new Set([...state.completed].filter((id) => activeIds.has(id)));
    state.config = config;
    grid.innerHTML = '';
    config.tasks.filter((task) => task.enabled).forEach((task) => grid.appendChild(makeTaskCard(task)));
    startLabel.textContent = `${config.startTime} スタート`;
    endLabel.textContent = `${config.endTime} あさのかい`;
    document.documentElement.dataset.gradeMode = config.mode || 'low';
    paintProgress();

    if (syncStatus) {
      syncStatus.textContent = source === 'teacher' ? 'せんせいの へんこうを うけとりました' : 'このたんまつは じゅんびOK';
      if (source === 'teacher') setTimeout(() => { syncStatus.textContent = 'このたんまつは じゅんびOK'; }, 3500);
    }
    window.dispatchEvent(new CustomEvent('morning-config-loaded', { detail: config }));
  }

  function readStored() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try { return JSON.parse(stored); } catch (_) { return null; }
  }

  async function load() {
    const stored = readStored();
    if (stored) return render(stored, 'local');
    try {
      const response = await fetch('data/tasks.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      render(await response.json(), 'local');
    } catch (error) {
      console.error('Task config load failed:', error);
      if (syncStatus) syncStatus.textContent = 'せっていを よみこめませんでした';
    }
  }

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener('message', (event) => {
      if (event.data?.type === 'config-published' && event.data.config) render(event.data.config, 'teacher');
    });
  }
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try { render(JSON.parse(event.newValue), 'teacher'); } catch (_) {}
  });

  window.MorningTasks = { load, render };
  load();
})();
