(() => {
  const STORAGE_KEY = 'school-checkin:published-config';
  const CHANNEL_NAME = 'school-checkin-config';
  const list = document.getElementById('teacher-task-list');
  const preview = document.getElementById('preview-list');
  const publishBar = document.querySelector('.publish-bar');
  const saveStatus = document.getElementById('save-status');
  const serverStatus = document.getElementById('server-status');
  const publishButton = document.getElementById('publish-button');
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;

  const state = { config: null, dirty: false, serverOnline: false };
  const presets = {
    normal: [['contact-book','れんらくちょう','📒',2,'blue'],['homework','しゅくだい','📚',2,'green'],['health','けんこう','🌡️',1,'orange'],['reading','ほんを よむ','📖',10,'purple']],
    monday: [['contact-book','れんらくちょう','📒',2,'blue'],['homework','しゅくだい','📚',2,'green'],['health','けんこう','🌡️',1,'orange'],['monday-set','月ようびの じゅんび','👜',3,'yellow'],['reading','ほんを よむ','📖',7,'purple']],
    rainy: [['umbrella','かさを しまう','☂️',2,'blue'],['contact-book','れんらくちょう','📒',2,'green'],['homework','しゅくだい','📚',2,'orange'],['reading','しずかに ほんを よむ','📖',9,'purple']],
    assembly: [['contact-book','れんらくちょう','📒',2,'blue'],['homework','しゅくだい','📚',2,'green'],['assembly','しゅうかいの じゅんび','🎒',3,'orange']]
  };

  const id = () => `task-${Date.now()}-${Math.random().toString(16).slice(2,6)}`;
  const markDirty = () => {
    state.dirty = true;
    publishBar?.classList.remove('saved');
    if (saveStatus) saveStatus.textContent = '変更があります。内容を確認して反映してください';
  };

  function syncMetaFromControls() {
    state.config.classId = document.getElementById('class-id').value.trim() || '1-1';
    state.config.startTime = document.getElementById('start-time').value || '08:15';
    state.config.endTime = document.getElementById('end-time').value || '08:30';
    state.config.mode = document.getElementById('grade-mode').value;
  }

  function paintPreview() {
    syncMetaFromControls();
    preview.innerHTML = '';
    state.config.tasks.filter(t => t.enabled).forEach(task => {
      const item = document.createElement('div');
      item.className = 'preview-item';
      item.innerHTML = `<span class="ico">${task.icon || '⭐'}</span><b>${escapeHtml(task.label || 'やること')}</b><small>${Number(task.minutes)||1}ぷん</small>`;
      preview.appendChild(item);
    });
    document.getElementById('preview-time').textContent = state.config.startTime;
    const [sh,sm] = state.config.startTime.split(':').map(Number);
    const [eh,em] = state.config.endTime.split(':').map(Number);
    const mins = Math.max(0,(eh*60+em)-(sh*60+sm));
    document.getElementById('preview-countdown').textContent = `あと ${mins}ぷん`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  }

  function updateTask(index, patch) { Object.assign(state.config.tasks[index], patch); markDirty(); render(); }
  function moveTask(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= state.config.tasks.length) return;
    const [item] = state.config.tasks.splice(index,1);
    state.config.tasks.splice(target,0,item);
    markDirty(); render();
  }

  function render() {
    list.innerHTML = '';
    state.config.tasks.forEach((task,index) => {
      const row = document.createElement('div');
      row.className = `teacher-task${task.enabled ? '' : ' disabled'}`;
      row.innerHTML = `
        <div class="move-stack"><button type="button" aria-label="上へ">↑</button><button type="button" aria-label="下へ">↓</button></div>
        <input class="icon-input" aria-label="アイコン" maxlength="4" value="${escapeHtml(task.icon || '⭐')}">
        <input class="label-input" aria-label="項目名" maxlength="28" value="${escapeHtml(task.label || '')}">
        <label class="minute-wrap"><input class="minute-input" aria-label="目安時間" type="number" min="1" max="30" value="${Number(task.minutes)||1}">分</label>
        <button class="toggle${task.enabled ? ' on' : ''}" type="button" aria-label="表示切替" aria-pressed="${task.enabled}"></button>
        <button class="delete-button" type="button">削除</button>`;
      const [up,down] = row.querySelectorAll('.move-stack button');
      up.onclick = () => moveTask(index,-1); down.onclick = () => moveTask(index,1);
      row.querySelector('.icon-input').oninput = e => { state.config.tasks[index].icon=e.target.value; markDirty(); paintPreview(); };
      row.querySelector('.label-input').oninput = e => { state.config.tasks[index].label=e.target.value; markDirty(); paintPreview(); };
      row.querySelector('.minute-input').oninput = e => { state.config.tasks[index].minutes=Math.max(1,Number(e.target.value)||1); markDirty(); paintPreview(); };
      row.querySelector('.toggle').onclick = () => updateTask(index,{enabled:!task.enabled});
      row.querySelector('.delete-button').onclick = () => { state.config.tasks.splice(index,1); markDirty(); render(); };
      list.appendChild(row);
    });
    paintPreview();
  }

  function applyPreset(name) {
    const preset = presets[name]; if (!preset) return;
    state.config.tasks = preset.map(([taskId,label,icon,minutes,accent]) => ({id:taskId,label,icon,minutes,enabled:true,accent}));
    markDirty(); render();
  }

  async function checkServer() {
    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      if (!response.ok) throw new Error('health failed');
      state.serverOnline = true;
      serverStatus.textContent = '校内LANサーバー接続OK';
      return true;
    } catch (_) {
      state.serverOnline = false;
      serverStatus.textContent = 'サーバー未接続：このPC内だけで反映します';
      return false;
    }
  }

  async function publish() {
    syncMetaFromControls();
    state.config.version = Number(state.config.version || 0) + 1;
    state.config.date = new Date().toISOString().slice(0,10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.config));
    channel?.postMessage({type:'config-published',config:state.config});

    publishButton.disabled = true;
    saveStatus.textContent = 'クラスへ反映しています…';
    let connected = null;
    try {
      const response = await fetch(`/api/classes/${encodeURIComponent(state.config.classId)}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.config)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      state.config = result.config || state.config;
      connected = Number(result.connected || 0);
      state.serverOnline = true;
      serverStatus.textContent = `校内LANへ配信済み・接続 ${connected}台`;
    } catch (error) {
      console.warn('LAN publish fallback:', error);
      state.serverOnline = false;
      serverStatus.textContent = 'LAN配信できませんでした・このPC内には保存済み';
    } finally {
      publishButton.disabled = false;
    }

    state.dirty = false;
    publishBar?.classList.add('saved');
    saveStatus.textContent = state.serverOnline
      ? `反映しました（設定 v${state.config.version}）`
      : `このPCに保存しました（設定 v${state.config.version}）`;
  }

  async function load() {
    await checkServer();
    const classId = document.getElementById('class-id').value.trim() || '1-1';
    if (state.serverOnline) {
      try {
        const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/today`, { cache: 'no-store' });
        if (response.ok) state.config = await response.json();
      } catch (_) {}
    }
    if (!state.config) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) { try { state.config = JSON.parse(stored); } catch (_) {} }
    }
    if (!state.config) {
      const response = await fetch('data/tasks.json',{cache:'no-store'});
      state.config = await response.json();
    }
    document.getElementById('class-id').value = state.config.classId || '1-1';
    document.getElementById('start-time').value = state.config.startTime || '08:15';
    document.getElementById('end-time').value = state.config.endTime || '08:30';
    document.getElementById('grade-mode').value = state.config.mode || 'low';
    render();
  }

  document.getElementById('add-task').onclick = () => { state.config.tasks.push({id:id(),label:'あたらしい やること',icon:'⭐',minutes:2,enabled:true,accent:'blue'}); markDirty(); render(); };
  document.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => applyPreset(b.dataset.preset));
  ['class-id','start-time','end-time','grade-mode'].forEach(key => document.getElementById(key).addEventListener('input',()=>{markDirty();paintPreview();}));
  publishButton.onclick = publish;

  const paintClock = () => { document.getElementById('teacher-clock').textContent = new Intl.DateTimeFormat('ja-JP',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date()); };
  paintClock(); setInterval(paintClock,1000); setInterval(checkServer,30000);
  load().catch(err => { console.error(err); saveStatus.textContent='設定を読み込めませんでした'; });
})();
