(() => {
  const countdownEl=document.getElementById('countdown'), bottomEl=document.getElementById('bottom-countdown'), fillEl=document.getElementById('timer-fill'), startLabel=document.getElementById('start-time-label'), endLabel=document.getElementById('end-time-label'), bottomLabel=document.getElementById('child-time-label');
  const schedule={start:'08:15',end:'08:30',mode:'low'};
  function toTodayTime(hhmm,now){const[hour,minute]=hhmm.split(':').map(Number);const value=new Date(now);value.setHours(hour,minute,0,0);return value;}
  function setText(main,bottom){if(countdownEl)countdownEl.textContent=main;if(bottomEl)bottomEl.textContent=bottom||main;}
  function renderTimer(){const now=window.ClassroomClock?.now?.()??new Date(),start=toTodayTime(schedule.start,now),end=toTodayTime(schedule.end,now),total=Math.max(1,end-start),remaining=end-now,elapsed=now-start,ratio=Math.max(0,Math.min(1,elapsed/total)),high=schedule.mode==='high';
    if(startLabel)startLabel.textContent=high?`${schedule.start} 開始`:`${schedule.start} スタート`;
    if(endLabel)endLabel.textContent=high?`${schedule.end} 朝の会`:`${schedule.end} あさのかい`;
    if(bottomLabel)bottomLabel.textContent=high?'残り時間':'のこりじかん';
    if(now<start){const minutes=Math.ceil((start-now)/60000);setText(high?`開始まで ${minutes}分`:`はじまりまで ${minutes}ぷん`,high?`${minutes}分`:`${minutes}ぷん`);fillEl.style.width='0%';return;}
    if(remaining<=0){setText(high?'朝の会の時間です':'あさのかいの じかん！',high?'0分':'0ぷん');fillEl.style.width='100%';return;}
    const minutes=Math.ceil(remaining/60000);setText(high?`あと ${minutes}分`:(minutes<=1?'あと 1ぷん':`あと ${minutes}ぷん`),high?`${minutes}分`:`${minutes}ぷん`);fillEl.style.width=`${ratio*100}%`;}
  function setSchedule(next){if(next?.start)schedule.start=next.start;if(next?.end)schedule.end=next.end;if(next?.mode)schedule.mode=next.mode==='high'?'high':'low';renderTimer();}
  renderTimer();window.setInterval(renderTimer,1000);window.MorningTimer={setSchedule};
})();
