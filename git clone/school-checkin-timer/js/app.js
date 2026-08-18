(() => {
  const taskButtons = [...document.querySelectorAll('[data-task]')];
  const doneEl = document.getElementById('task-done');
  const totalEl = document.getElementById('task-total');
  const weatherButtons = [...document.querySelectorAll('.weather')];

  function updateTaskProgress() {
    const done = taskButtons.filter((button) => button.classList.contains('done')).length;
    doneEl.textContent = String(done);
    totalEl.textContent = String(taskButtons.length);
  }

  taskButtons.forEach((button) => {
    button.addEventListener('click', () => {
      button.classList.toggle('done');
      button.setAttribute('aria-pressed', button.classList.contains('done') ? 'true' : 'false');
      updateTaskProgress();
    });
  });

  weatherButtons.forEach((button) => {
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      weatherButtons.forEach((item) => {
        item.classList.remove('selected');
        item.setAttribute('aria-pressed', 'false');
      });
      button.classList.add('selected');
      button.setAttribute('aria-pressed', 'true');
    });
  });

  updateTaskProgress();
})();
