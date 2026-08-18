const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const APP_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data', 'classes');
const DEFAULT_CONFIG = path.join(APP_ROOT, 'data', 'tasks.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(express.static(APP_ROOT, { extensions: ['html'] }));

const safeClassId = value => /^[0-9A-Za-z_-]{1,32}$/.test(String(value || '').trim()) ? String(value).trim() : null;
const safeDeviceId = value => String(value || '').replace(/[^0-9A-Za-z_-]/g, '').slice(0, 64) || `device-${Math.random().toString(36).slice(2, 10)}`;
const configPath = classId => path.join(DATA_DIR, `${classId}.json`);
const readJson = filePath => JSON.parse(fs.readFileSync(filePath, 'utf8'));
function readConfig(classId) {
  const saved = configPath(classId);
  return fs.existsSync(saved) ? readJson(saved) : { ...readJson(DEFAULT_CONFIG), classId };
}
function validateConfig(input, classId) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.tasks)) return { ok:false, message:'設定データが正しくありません。' };
  if (input.tasks.length > 30) return { ok:false, message:'タスクは30件以内にしてください。' };
  const tasks = input.tasks.map((task,index)=>({
    id:String(task.id || `task-${index+1}`).slice(0,80), label:String(task.label || 'やること').slice(0,40),
    icon:String(task.icon || '⭐').slice(0,8), minutes:Math.min(60,Math.max(1,Number(task.minutes)||1)),
    enabled:task.enabled !== false, accent:String(task.accent || 'blue').slice(0,16)
  }));
  const timePattern=/^([01]\d|2[0-3]):[0-5]\d$/;
  return { ok:true, config:{ classId, date:/^\d{4}-\d{2}-\d{2}$/.test(String(input.date||''))?input.date:new Date().toISOString().slice(0,10),
    version:Math.max(1,Number(input.version)||1), mode:input.mode==='high'?'high':'low',
    startTime:timePattern.test(String(input.startTime||''))?input.startTime:'08:15', endTime:timePattern.test(String(input.endTime||''))?input.endTime:'08:30',
    updatedAt:new Date().toISOString(), tasks } };
}
function writeConfig(classId, config) {
  const target=configPath(classId), temp=`${target}.tmp`;
  fs.writeFileSync(temp,`${JSON.stringify(config,null,2)}\n`,'utf8'); fs.renameSync(temp,target);
}

const server=http.createServer(app);
const wss=new WebSocketServer({server,path:'/ws'});
const rooms=new Map();
function roomFor(classId){ if(!rooms.has(classId)) rooms.set(classId,new Map()); return rooms.get(classId); }
function snapshot(classId){
  const room=roomFor(classId); let latestVersion=0; try{latestVersion=Number(readConfig(classId).version)||0;}catch(_){}
  return [...room.values()].map(d=>({deviceId:d.deviceId,connectedAt:d.connectedAt,lastSeen:d.lastSeen,ackVersion:d.ackVersion||0,latestVersion,upToDate:(d.ackVersion||0)>=latestVersion}));
}
function broadcast(classId,message){ const payload=JSON.stringify(message); for(const d of roomFor(classId).values()) if(d.socket.readyState===WebSocket.OPEN)d.socket.send(payload); }
function broadcastPresence(classId){ broadcast(classId,{type:'presence',connected:roomFor(classId).size,devices:snapshot(classId)}); }

app.get('/api/health',(_req,res)=>res.json({ok:true,service:'school-checkin-timer',now:new Date().toISOString()}));
app.get('/api/time',(_req,res)=>{res.set('Cache-Control','no-store');res.json({now:Date.now(),iso:new Date().toISOString()});});
app.get('/api/classes/:classId/today',(req,res)=>{ const classId=safeClassId(req.params.classId); if(!classId)return res.status(400).json({error:'invalid_class_id'}); try{res.set('Cache-Control','no-store');return res.json(readConfig(classId));}catch(e){console.error(e);return res.status(500).json({error:'read_failed'});} });
app.get('/api/classes/:classId/devices',(req,res)=>{ const classId=safeClassId(req.params.classId); if(!classId)return res.status(400).json({error:'invalid_class_id'}); res.set('Cache-Control','no-store'); return res.json({classId,connected:roomFor(classId).size,devices:snapshot(classId)}); });
app.post('/api/classes/:classId/config',(req,res)=>{ const classId=safeClassId(req.params.classId); if(!classId)return res.status(400).json({error:'invalid_class_id'}); const checked=validateConfig(req.body,classId); if(!checked.ok)return res.status(400).json({error:'invalid_config',message:checked.message}); try{writeConfig(classId,checked.config); broadcast(classId,{type:'config-published',config:checked.config}); setTimeout(()=>broadcastPresence(classId),250); return res.json({ok:true,config:checked.config,connected:roomFor(classId).size});}catch(e){console.error(e);return res.status(500).json({error:'write_failed'});} });

wss.on('connection',(socket,request)=>{
  const url=new URL(request.url,`http://${request.headers.host||'localhost'}`); const classId=safeClassId(url.searchParams.get('classId'));
  if(!classId){socket.close(1008,'classId required');return;}
  const deviceId=safeDeviceId(url.searchParams.get('deviceId')); const room=roomFor(classId);
  const old=room.get(deviceId); if(old?.socket && old.socket!==socket) old.socket.close(4000,'reconnected');
  const device={deviceId,socket,connectedAt:Date.now(),lastSeen:Date.now(),ackVersion:0}; room.set(deviceId,device);
  let config=null; try{config=readConfig(classId);}catch(_){}
  socket.send(JSON.stringify({type:'hello',classId,deviceId,connected:room.size,serverTime:Date.now(),config})); broadcastPresence(classId);
  socket.on('message',raw=>{ try{const m=JSON.parse(String(raw)); device.lastSeen=Date.now(); if(m.type==='config-ack'){device.ackVersion=Number(m.version)||0; broadcastPresence(classId);} if(m.type==='ping')socket.send(JSON.stringify({type:'pong',serverTime:Date.now()}));}catch(_){} });
  socket.on('close',()=>{ if(room.get(deviceId)?.socket===socket)room.delete(deviceId); if(room.size===0)rooms.delete(classId); else broadcastPresence(classId); });
});
server.listen(PORT,HOST,()=>{console.log(`School Check-in Timer: http://localhost:${PORT}`);console.log(`LAN: http://<teacher-pc-ip>:${PORT}`);});
