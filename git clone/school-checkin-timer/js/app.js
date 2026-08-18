(() => {
  const weatherButtons=[...document.querySelectorAll('.weather')];
  const note=document.getElementById('high-note');
  const brand=document.getElementById('brand-message');
  const mainTitle=document.querySelector('.brand h1');
  const weatherKicker=document.getElementById('weather-kicker');
  const weatherTitle=document.getElementById('weather-title');
  const routineKicker=document.getElementById('routine-kicker');
  const routineTitle=document.getElementById('routine-title');
  const celebration=document.getElementById('completion-celebration');
  const celebrationTitle=document.getElementById('celebration-title');
  const celebrationMessage=document.getElementById('celebration-message');
  const closeButton=document.getElementById('celebration-close');
  const weatherLow=['はれ','くもり','あめ','かみなり'];
  const weatherHigh=['晴れ','曇り','雨','雷'];
  let celebrated=false, noteTimer=null, mode='low';

  weatherButtons.forEach((button,index)=>{
    const weather=['sunny','cloudy','rainy','thunder'][index];
    button.dataset.weather=weather;
    button.setAttribute('aria-pressed','false');
    button.addEventListener('click',()=>{
      weatherButtons.forEach(item=>{item.classList.remove('selected');item.setAttribute('aria-pressed','false');});
      button.classList.add('selected');button.setAttribute('aria-pressed','true');
      window.MorningTasks?.setWeather(weather);
    });
  });

  note?.addEventListener('input',()=>{
    clearTimeout(noteTimer);
    noteTimer=setTimeout(()=>window.MorningTasks?.setNote(note.value),350);
  });

  function applyMode(nextMode){
    mode=nextMode==='high'?'high':'low';
    document.documentElement.dataset.gradeMode=mode;
    weatherButtons.forEach((button,index)=>{const label=button.querySelector('b');if(label)label.textContent=(mode==='high'?weatherHigh:weatherLow)[index];});
    if(mode==='high'){
      if(mainTitle)mainTitle.textContent='朝のチェックイン';
      brand.textContent='おはよう。今日のスタートを自分で整えよう';
      weatherKicker.textContent='今の自分の状態を'; weatherTitle.textContent='天気で表すと？';
      routineKicker.textContent='朝の準備'; routineTitle.textContent='見通しをもって進めよう';
      if(note)note.placeholder='今の気持ちや、先生に伝えたいこと（書かなくてもOK）';
    }else{
      if(mainTitle)mainTitle.textContent='あさの チェックイン';
      brand.textContent='おはよう！ きょうも いいスタートを';
      weatherKicker.textContent='きょうの こころは'; weatherTitle.textContent='どんな てんき？';
      routineKicker.textContent='あさの じゅんび'; routineTitle.textContent='できたら タッチ！';
    }
  }

  function showCelebration(){
    if(!celebration||celebrated)return;
    celebrated=true;
    celebrationTitle.textContent=mode==='high'?'朝の準備 完了！':'あさの じゅんび かんりょう！';
    celebrationMessage.textContent=mode==='high'?'今日も自分のペースで、いい一日にしよう。':'きょうも いい一日に しよう！';
    celebration.hidden=false;
    requestAnimationFrame(()=>celebration.classList.add('show'));
  }
  function hideCelebration(){if(!celebration)return;celebration.classList.remove('show');setTimeout(()=>{celebration.hidden=true;},180);}
  closeButton?.addEventListener('click',hideCelebration);

  window.addEventListener('morning-config-loaded',e=>{applyMode(e.detail?.mode);celebrated=false;});
  window.addEventListener('morning-task-progress',e=>{const {done,total}=e.detail||{};if(total>0&&done===total)showCelebration();else if(done<total)celebrated=false;});
})();
