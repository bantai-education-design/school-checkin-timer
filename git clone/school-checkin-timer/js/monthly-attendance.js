(() => {
  const cls = document.getElementById('ledger-class');
  const month = document.getElementById('ledger-month');
  const status = document.getElementById('ledger-status');
  const table = document.getElementById('ledger-table');
  const reason = document.getElementById('reason-totals');
  const healthRoot = document.getElementById('health-totals');

  const symbols = {
    present: '○',
    unconfirmed: '?',
    sick: '病',
    accident: '事',
    late: '遅',
    early: '早',
    suspended: '停'
  };

  const labels = {
    present: '出席',
    unconfirmed: '未確認',
    sick: '病欠',
    accident: '事故欠',
    late: '遅刻',
    early: '早退',
    suspended: '出席停止等'
  };

  const healthLabels = {
    ok: '健康 ○',
    watch: '要観察',
    nurse: '保健室',
    unwell: '体調不良',
    other: 'その他'
  };

  const keys = ['present', 'sick', 'accident', 'late', 'early', 'suspended', 'unconfirmed'];

  function normalizeCalendar(data, ym) {
    if (data?.calendar && Object.keys(data.calendar).length) return data.calendar;

    const calendar = {};
    for (const date of data?.schoolDates || []) {
      calendar[date] = { type: 'school', reason: '', source: 'server' };
    }
    if (Object.keys(calendar).length) return calendar;

    const [year, monthNumber] = ym.split('-').map(Number);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    for (let day = 1; day <= lastDay; day += 1) {
      const dt = new Date(year, monthNumber - 1, day);
      const iso = `${ym}-${String(day).padStart(2, '0')}`;
      const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
      calendar[iso] = {
        type: isWeekend ? 'off' : 'school',
        reason: isWeekend ? '土日' : '',
        source: 'auto'
      };
    }
    return calendar;
  }

  function summarize(data) {
    const days = {};
    for (const date of data.dates || []) days[date] = data.days[date] || [];
    return window.AttendanceModel.summarizeMonth(days);
  }

  function healthSummary(data) {
    const totals = { ok: 0, watch: 0, nurse: 0, unwell: 0, other: 0 };
    for (const date of data.dates || []) {
      for (const record of data.days[date] || []) {
        const key = healthLabels[record.health] ? record.health : 'ok';
        totals[key] += 1;
      }
    }
    return totals;
  }

  function resetSummary() {
    ['m-days', 'm-present', 'm-absent', 'm-sick', 'm-accident', 'm-late', 'm-early'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '0';
    });
    reason.innerHTML = '';
    if (healthRoot) healthRoot.innerHTML = '';
  }

  function paint(data, ym) {
    const calendar = normalizeCalendar(data, ym);
    const dates = Object.keys(calendar).filter(date => calendar[date]?.type !== 'off').sort();
    const confirmed = new Set(data.dates || []);
    const summary = summarize(data);
    const health = healthSummary(data);
    const roster = data.roster || [];
    const head = table.tHead || table.createTHead();
    const body = table.tBodies[0] || table.createTBody();
    const foot = table.tFoot || table.createTFoot();

    head.innerHTML = '';
    body.innerHTML = '';
    foot.innerHTML = '';

    if (!dates.length) {
      body.innerHTML = '<tr><td class="empty">この月には授業日が設定されていません。</td></tr>';
      resetSummary();
      return;
    }

    const headerRow = document.createElement('tr');
    const dayHeaders = dates.map(date => {
      const dt = new Date(`${date}T12:00:00`);
      const isConfirmed = confirmed.has(date);
      const calendarItem = calendar[date] || {};
      const special = calendarItem.type === 'special';
      const source = calendarItem.source === 'c4th'
        ? 'C4th'
        : calendarItem.source === 'teacher'
          ? '先生修正'
          : '自動';
      return `<th class="day-col${isConfirmed ? '' : ' pending'}" title="${isConfirmed ? '確認済み' : '未確認'} / ${calendarItem.reason || source}">${dt.getDate()}<br><small>${'日月火水木金土'[dt.getDay()]}${special ? '★' : ''}</small></th>`;
    }).join('');

    headerRow.innerHTML = '<th class="num-col">番号</th><th class="sticky name-col">氏名</th>'
      + dayHeaders
      + keys.map(key => `<th class="total-col">${labels[key]}</th>`).join('');
    head.appendChild(headerRow);

    const rowMap = new Map();
    roster.forEach(student => rowMap.set(student.studentKey, { student, records: [] }));
    (data.dates || []).forEach(date => {
      (data.days[date] || []).forEach(record => {
        if (rowMap.has(record.studentKey)) rowMap.get(record.studentKey).records.push({ date, ...record });
      });
    });

    [...rowMap.values()]
      .sort((a, b) => (a.student.number || 999) - (b.student.number || 999))
      .forEach(({ student, records }) => {
        const byDate = new Map(records.map(record => [record.date, record]));
        const totals = window.AttendanceModel.summarizeStudent(records);
        const row = document.createElement('tr');

        const dayCells = dates.map(date => {
          if (!confirmed.has(date)) return '<td class="status-unconfirmed" title="授業日・未確認">—</td>';
          const record = byDate.get(date);
          const key = record?.status || 'unconfirmed';
          const healthLabel = healthLabels[record?.health] || '健康未設定';
          return `<td class="status-${key}" title="${labels[key]} / ${healthLabel}">${symbols[key]}</td>`;
        }).join('');

        row.innerHTML = `<td>${student.number ?? ''}</td><td class="sticky name-col">${student.name || '氏名未登録'}</td>`
          + dayCells
          + keys.map(key => `<td class="total-col">${totals[key] || 0}</td>`).join('');
        body.appendChild(row);
      });

    const presentRow = document.createElement('tr');
    const presentCells = dates.map(date => {
      const value = confirmed.has(date) ? (summary.dayTotals[date]?.present || 0) : '—';
      return `<td>${value}</td>`;
    }).join('');
    presentRow.innerHTML = '<th colspan="2">日別 出席</th>'
      + presentCells
      + keys.map(key => `<td rowspan="2">${summary.grand[key] || 0}</td>`).join('');
    foot.appendChild(presentRow);

    const absentRow = document.createElement('tr');
    const absentCells = dates.map(date => {
      if (!confirmed.has(date)) return '<td>—</td>';
      const totals = summary.dayTotals[date] || {};
      return `<td title="病欠 ${totals.sick || 0}・事故欠 ${totals.accident || 0}">${totals.absence || 0}</td>`;
    }).join('');
    absentRow.innerHTML = '<th colspan="2">日別 欠席</th>' + absentCells;
    foot.appendChild(absentRow);

    document.getElementById('m-days').textContent = dates.length;
    document.getElementById('m-present').textContent = summary.grand.present || 0;
    document.getElementById('m-absent').textContent = summary.grand.absence || 0;
    document.getElementById('m-sick').textContent = summary.grand.sick || 0;
    document.getElementById('m-accident').textContent = summary.grand.accident || 0;
    document.getElementById('m-late').textContent = summary.grand.late || 0;
    document.getElementById('m-early').textContent = summary.grand.early || 0;

    reason.innerHTML = `<article class="reason-main"><span>欠席 合計</span><strong>${summary.grand.absence || 0}</strong><small>病欠＋事故欠</small></article>`
      + `<article><span>授業日</span><strong>${dates.length}</strong><small>学校暦基準</small></article>`
      + `<article><span>確認済み</span><strong>${confirmed.size}</strong><small>日</small></article>`
      + `<article><span>未確認授業日</span><strong>${dates.filter(date => !confirmed.has(date)).length}</strong><small>日</small></article>`
      + keys.map(key => `<article><span>${labels[key]}</span><strong>${summary.grand[key] || 0}</strong></article>`).join('');

    if (healthRoot) {
      healthRoot.innerHTML = Object.entries(healthLabels).map(([key, label]) => {
        const emphasis = ['watch', 'nurse', 'unwell'].includes(key) ? ' class="reason-main"' : '';
        return `<article${emphasis}><span>${label}</span><strong>${health[key] || 0}</strong><small>延べ件数</small></article>`;
      }).join('');
    }
  }

  async function refresh() {
    status.textContent = '集計しています…';
    const classId = cls.value.trim() || '1-1';
    const ym = month.value;

    try {
      const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/attendance/month/${ym}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('attendance fetch failed');
      const data = await response.json();
      paint(data, ym);
      const calendar = normalizeCalendar(data, ym);
      const schoolDays = Object.keys(calendar).filter(date => calendar[date]?.type !== 'off').length;
      status.textContent = `授業日 ${schoolDays}日 ／ 出席・健康確認済み ${data.dates?.length || 0}日`;
    } catch (_) {
      status.textContent = '校内LANサーバーに接続できません';
    }
  }

  const now = new Date();
  month.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  document.getElementById('ledger-reload').onclick = refresh;
  cls.onchange = refresh;
  month.onchange = refresh;
  refresh();
})();
