const { WebSocket } = require('ws');

const base = process.env.BASE_URL || 'http://127.0.0.1:8080';
const wsBase = base.replace(/^http/, 'ws');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function getJson(path) {
  const response = await fetch(`${base}${path}`, { cache: 'no-store' });
  assert(response.ok, `${path} returned ${response.status}`);
  return response.json();
}

async function getText(path) {
  const response = await fetch(`${base}${path}`, { cache: 'no-store' });
  assert(response.ok, `${path} returned ${response.status}`);
  return response.text();
}

async function postJson(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  assert(response.ok, `${path} returned ${response.status}`);
  return response.json();
}

function openSocket(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => reject(new Error('WebSocket open timeout')), 5000);
    socket.once('open', () => { clearTimeout(timer); resolve(socket); });
    socket.once('error', reject);
  });
}

function waitFor(socket, predicate, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error('WebSocket message timeout')); }, timeout);
    const onMessage = raw => {
      try {
        const message = JSON.parse(String(raw));
        if (!predicate(message)) return;
        cleanup(); resolve(message);
      } catch (_) {}
    };
    const cleanup = () => { clearTimeout(timer); socket.off('message', onMessage); };
    socket.on('message', onMessage);
  });
}

(async () => {
  const health = await getJson('/api/health');
  assert(health.ok === true, 'health.ok is not true');

  const time = await getJson('/api/time');
  assert(Number.isFinite(time.now), 'server time is missing');

  for (const page of ['/', '/teacher.html', '/attendance.html', '/monthly-attendance.html', '/term-attendance.html', '/dashboard.html', '/school-calendar.html', '/term-settings.html', '/preview.html', '/setup.html']) {
    const html = await getText(page);
    assert(/<!DOCTYPE html>|<html/i.test(html), `${page} is not HTML`);
  }

  for (const asset of [
    '/assets/images/tasks/contact-book.svg',
    '/assets/images/tasks/desk.svg',
    '/assets/images/tasks/reading.svg',
    '/assets/images/tasks/temperature.svg',
    '/assets/images/tasks/submission.svg'
  ]) {
    const svg = await getText(asset);
    assert(/<svg[\s>]/i.test(svg), `${asset} is not SVG artwork`);
  }

  const classId = '6-3';
  const deviceId = '6-3-07';
  const studentKey = 'smoke-student-07';
  const socket = await openSocket(`${wsBase}/ws?classId=${classId}&deviceId=${deviceId}`);
  const hello = await waitFor(socket, message => message.type === 'hello');
  assert(hello.classId === classId, 'hello classId mismatch');

  const current = await getJson(`/api/classes/${classId}/today`);
  const next = {
    ...current,
    classId,
    version: Number(current.version || 0) + 1,
    startTime: '08:10',
    endTime: '08:25',
    roster: [
      { number: 7, name: 'テスト児童', deviceId, studentKey }
    ],
    tasks: [
      { id: 'submit', label: '提出物', icon: '📮', minutes: 2, enabled: true, accent: 'blue' },
      { id: 'reading', label: '朝読書', icon: '📖', minutes: 10, enabled: true, accent: 'green' }
    ]
  };

  const publishPromise = waitFor(socket, message => message.type === 'config-published');
  const publishResponse = await fetch(`${base}/api/classes/${classId}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(next)
  });
  assert(publishResponse.ok, `config publish returned ${publishResponse.status}`);
  const published = await publishPromise;
  assert(published.config.version === next.version, 'published version mismatch');

  socket.send(JSON.stringify({ type: 'config-ack', version: next.version, deviceId }));
  socket.send(JSON.stringify({ type: 'student-state', deviceId, weather: 'cloudy', done: 2, total: 2, finished: true, note: '少し眠い' }));
  await new Promise(resolve => setTimeout(resolve, 250));

  const devices = await getJson(`/api/classes/${classId}/devices`);
  const device = devices.devices.find(item => item.deviceId === deviceId);
  assert(device, 'device not listed');
  assert(device.ackVersion >= next.version, 'config ack not recorded');

  const dashboard = await getJson(`/api/classes/${classId}/dashboard`);
  const student = dashboard.students.find(item => item.deviceId === deviceId);
  assert(student, 'student state not listed');
  assert(student.weather === 'cloudy', 'weather not recorded');
  assert(student.done === 2 && student.total === 2, 'task progress not recorded');
  assert(student.note === '少し眠い', 'note not recorded');

  const date = new Date().toISOString().slice(0, 10);
  const attendanceBefore = await getJson(`/api/classes/${classId}/attendance/${date}`);
  const attendanceStudent = attendanceBefore.students.find(item => item.studentKey === studentKey);
  assert(attendanceStudent, 'attendance roster student not listed');
  assert(attendanceStudent.weather === 'cloudy', 'live mood should be visible for teacher context');

  await postJson(`/api/classes/${classId}/attendance/${date}`, {
    studentKey,
    status: 'present',
    health: 'watch',
    healthMemo: '朝は少し眠そう',
    reason: ''
  });
  const attendanceAfter = await getJson(`/api/classes/${classId}/attendance/${date}`);
  const savedAttendance = attendanceAfter.students.find(item => item.studentKey === studentKey);
  assert(savedAttendance.status === 'present', 'attendance status not saved');
  assert(savedAttendance.health === 'watch', 'health observation not saved');
  assert(savedAttendance.weather === 'cloudy', 'saving health must not overwrite mood');

  const analytics = await getJson(`/api/classes/${classId}/analytics`);
  const moodDay = analytics.days.find(item => item.date === date);
  assert(moodDay && moodDay.cloudy >= 1, 'mood analytics lost after attendance health update');

  const schoolYear = Number(date.slice(0, 4));
  const terms = await getJson(`/api/classes/${classId}/terms/${schoolYear}`);
  assert(Array.isArray(terms.terms) && terms.terms.length >= 1, 'term settings API unavailable');
  const month = date.slice(0, 7);
  const calendar = await getJson(`/api/classes/${classId}/calendar/${month}`);
  assert(calendar.days && typeof calendar.days === 'object', 'school calendar API unavailable');

  socket.close();
  console.log('Smoke test passed: pages, formal task artwork, HTTP, WebSocket, config sync, attendance/health, mood separation, calendar/term APIs');
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
