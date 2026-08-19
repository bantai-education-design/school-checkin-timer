(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AttendanceModel = api;
})(typeof self !== 'undefined' ? self : this, function() {
  const STATUS = {
    present: '出席',
    unconfirmed: '未確認',
    sick: '病欠',
    accident: '事故欠',
    late: '遅刻',
    early: '早退',
    suspended: '出席停止等'
  };

  const ABSENCE = ['sick', 'accident'];

  function blank() {
    return {
      present: 0,
      unconfirmed: 0,
      sick: 0,
      accident: 0,
      late: 0,
      early: 0,
      suspended: 0,
      absence: 0
    };
  }

  function add(target, status) {
    const key = STATUS[status] ? status : 'unconfirmed';
    target[key] += 1;
    if (ABSENCE.includes(key)) target.absence += 1;
    return target;
  }

  function summarizeDay(records = []) {
    const totals = blank();
    records.forEach(record => add(totals, record.status));
    return { ...totals, total: records.length };
  }

  function summarizeStudent(records = []) {
    const totals = blank();
    records.forEach(record => add(totals, record.status));
    return { ...totals, total: records.length };
  }

  function summarizeMonth(days = {}) {
    const dayTotals = {};
    const studentMap = new Map();
    const grand = blank();

    Object.entries(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([date, records]) => {
        const list = Array.isArray(records) ? records : [];
        dayTotals[date] = summarizeDay(list);

        list.forEach(record => {
          const key = String(record.studentKey || record.deviceId || record.number || '');
          if (!key) return;

          if (!studentMap.has(key)) {
            studentMap.set(key, {
              studentKey: key,
              name: record.name || '',
              number: record.number || null,
              records: []
            });
          }

          studentMap.get(key).records.push(record);
          add(grand, record.status);
        });
      });

    const students = [...studentMap.values()]
      .map(student => ({ ...student, totals: summarizeStudent(student.records) }))
      .sort((a, b) => (a.number || 999) - (b.number || 999));

    const total = Object.values(days)
      .reduce((count, records) => count + (Array.isArray(records) ? records.length : 0), 0);

    return {
      dayTotals,
      students,
      grand: { ...grand, total }
    };
  }

  return {
    STATUS,
    ABSENCE,
    blank,
    summarizeDay,
    summarizeStudent,
    summarizeMonth
  };
});
