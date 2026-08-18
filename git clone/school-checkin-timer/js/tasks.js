(() => {
  const state = {
    config: null,
    completed: new Set()
  };

  const grid = document.getElementById('task-grid');
  const doneEl = document.getElementById('task-done');
  const totalEl = document.getElementById('task-total');
  const startLabel = document.getElementById('start-time-label');
  const endLabel = document.getElementById('end-time-label');

  function paintProgress() {
    const activeTasks = (state.config?.tasks || []).filter((task) => task.enabled);
    const done = activeTasks.filter((task) => state.completed.has(task.id)).length;
    doneEl.textContent = String(done);
    totalEl.textContent = String(activeTasks.length);
  }

  function makeTaskCard(task) {
    const button = document.createElement('button');
    button.className = `task-card task-${task.accent || 'blue'}`;
    button.type = 'button';
    button.dataset.taskId = task.id;
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = `
      <span class="task-icon">${task.icon}</span>
      <span class="task-copy">
        <span class="task-label">${task.label}</span>
        <small>${task.minutes}ぷん</small>
      </span>
      <span class="task-check">✓</span>
    `;

    button.addEventListener('click', () => {
      if (state.completed.has(task.id)) {
        state.completed.delete(task.id);
        button.classList.remove('done');
        button.setAttribute('aria-pressed', 'false');
      } else {
        state.completed.add(task.id);
        button.classList.add('done');
        button.setAttribute('aria-pressed', 'true');
      }
      paintProgress();
    });

    return button;
  }

  function render(config) {
    state.config = config;
    grid.innerHTML = '';
    config.tasks.filter((task) => task.enabled).forEach((task) => {
      grid.appendChild(makeTaskCard(task));
    });
    startLabel.textContent = `${config.startTime} スタート`;
    endLabel.textContent = `${config.endTime} あさのかい`;
    document.documentElement.dataset.gradeMode = config.mode || 'low';
    paintProgress();

    window.dispatchEvent(new CustomEvent('morning-config-loaded', { detail: config }));
  }

  async function load() {
    try {
      const response = await fetch('data/tasks.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      render(await response.json());
    } catch (error) {
      console.error('Task config load failed:', error);
      const status = document.getElementById('sync-status');
      if (status) status.textContent = 'せっていを よみこめませんでした';
    }
  }

  window.MorningTasks = { load, render };
  load();
})();
