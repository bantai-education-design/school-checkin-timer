const fs=require('fs');
const path=require('path');
const net=require('net');

const root=path.resolve(__dirname,'..');
const required=[
  'server/server.js','data/tasks.json','teacher.html','attendance.html','monthly-attendance.html','term-attendance.html','dashboard.html','school-calendar.html','term-settings.html','setup.html','preview.html',
  'assets/images/tasks/contact-book.svg','assets/images/tasks/desk.svg','assets/images/tasks/reading.svg','assets/images/tasks/temperature.svg','assets/images/tasks/submission.svg'
];
const dataDirs=['server/data/classes','server/data/history','server/data/attendance'];
const failures=[];
const notes=[];

function ok(cond,msg){if(!cond)failures.push(msg);}
const major=Number(process.versions.node.split('.')[0]);
ok(major>=20,`Node.js 20以上が必要です（現在 ${process.version}）`);

for(const rel of required){const p=path.join(root,rel);ok(fs.existsSync(p),`必須ファイルがありません: ${rel}`);}
for(const rel of dataDirs){const p=path.join(root,rel);try{fs.mkdirSync(p,{recursive:true});const probe=path.join(p,'.preflight-write-test');fs.writeFileSync(probe,'ok','utf8');fs.unlinkSync(probe);}catch(e){failures.push(`保存先へ書き込めません: ${rel} (${e.message})`);}}

const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
ok(pkg.scripts?.start==='node server/server.js','npm start の設定が想定と異なります');
ok(pkg.scripts?.['test:smoke'],'test:smoke が未定義です');
ok(pkg.scripts?.['test:visual'],'test:visual が未定義です');

function checkPort(){return new Promise(resolve=>{const server=net.createServer();server.once('error',e=>{if(e.code==='EADDRINUSE')notes.push('TCP 8080 は既に使用中です。School Check-in Timer が起動中なら問題ありません。');else failures.push(`TCP 8080 を確認できません: ${e.message}`);resolve();});server.once('listening',()=>server.close(resolve));server.listen(8080,'127.0.0.1');});}

(async()=>{await checkPort();if(failures.length){console.error('Preflight failed:\n- '+failures.join('\n- '));process.exit(1);}console.log('Preflight passed: Node, required files, task artwork, writable data folders, npm scripts, local port check');for(const note of notes)console.log(`Note: ${note}`);})().catch(e=>{console.error(e.stack||e);process.exit(1);});
