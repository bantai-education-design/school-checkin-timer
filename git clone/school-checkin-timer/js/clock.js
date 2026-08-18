(() => {
  const dateEl = document.getElementById('clock-date');
  const digitalEl = document.getElementById('digital-clock');
  const hourHand = document.getElementById('clock-hour');
  const minuteHand = document.getElementById('clock-minute');
  const secondHand = document.getElementById('clock-second');

  let serverOffsetMs = 0;

  function now() {
    return new Date(Date.now() + serverOffsetMs);
  }

  function setServerOffset(offsetMs) {
    serverOffsetMs = Number.isFinite(offsetMs) ? offsetMs : 0;
  }

  function renderClock() {
    const current = now();
    const hours = current.getHours();
    const minutes = current.getMinutes();
    const seconds = current.getSeconds();

    digitalEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    dateEl.textContent = new Intl.DateTimeFormat('ja-JP', {
      month: 'long', day: 'numeric', weekday: 'short'
    }).format(current);

    hourHand.style.transform = `rotate(${(hours % 12) * 30 + minutes * 0.5}deg)`;
    minuteHand.style.transform = `rotate(${minutes * 6 + seconds * 0.1}deg)`;
    secondHand.style.transform = `rotate(${seconds * 6}deg)`;
  }

  renderClock();
  window.setInterval(renderClock, 1000);

  window.ClassroomClock = { now, setServerOffset };
})();
