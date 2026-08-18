(() => {
  const countdownEl = document.getElementById('countdown');
  const fillEl = document.getElementById('timer-fill');
  const startLabel = document.getElementById('start-time-label');
  const endLabel = document.getElementById('end-time-label');

  const schedule = {
    start: '08:15',
    end: '08:30'
  };

  function toTodayTime(hhmm, now) {
    const [hour, minute] = hhmm.split(':').map(Number);
    const value = new Date(now);
    value.setHours(hour, minute, 0, 0);
    return value;
  }

  function renderTimer() {
    const now = window.ClassroomClock?.now?.() ?? new Date();
    const start = toTodayTime(schedule.start, now);
    const end = toTodayTime(schedule.end, now);
    const total = Math.max(1, end - start);
    const remaining = end - now;
    const elapsed = now - start;
    const ratio = Math.max(0, Math.min(1, elapsed / total));

    startLabel.textContent = `${schedule.start} スタート`;
    endLabel.textContent = `${schedule.end} あさのかい`;

    if (now < start) {
      const minutes = Math.ceil((start - now) / 60000);
      countdownEl.textContent = `はじまりまで ${minutes}ぷん`;
      fillEl.style.width = '0%';
      return;
    }

    if (remaining <= 0) {
      countdownEl.textContent = 'あさのかいの じかん！';
      fillEl.style.width = '100%';
      return;
    }

    const minutes = Math.ceil(remaining / 60000);
    countdownEl.textContent = minutes <= 1 ? 'あと 1ぷん' : `あと ${minutes}ぷん`;
    fillEl.style.width = `${ratio * 100}%`;
  }

  function setSchedule(next) {
    if (next?.start) schedule.start = next.start;
    if (next?.end) schedule.end = next.end;
    renderTimer();
  }

  renderTimer();
  window.setInterval(renderTimer, 1000);
  window.MorningTimer = { setSchedule };
})();
