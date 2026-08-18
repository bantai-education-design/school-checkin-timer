(() => {
  const PROFILE_KEY='school-checkin:device-profile';
  const DEVICE_KEY='school-checkin:device-id';
  const form=document.getElementById('device-form');
  const grade=document.getElementById('grade');
  const classNumber=document.getElementById('class-number');
  const seat=document.getElementById('seat-number');
  const preview=document.getElementById('device-preview').querySelector('strong');

  function currentProfile(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null');}catch(_){return null;}}
  function paint(){
    const g=grade.value,c=classNumber.value,n=Number(seat.value)||0;
    preview.textContent=g&&c&&n?`${g}年${c}組・${n}番のタブレット`:'学年・組・番号を選んでください';
  }
  const saved=currentProfile();
  if(saved){grade.value=String(saved.grade||'');classNumber.value=String(saved.classNumber||'');seat.value=String(saved.seatNumber||'');paint();}
  [grade,classNumber,seat].forEach(el=>el.addEventListener('input',paint));
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const g=Number(grade.value),c=Number(classNumber.value),n=Number(seat.value);
    if(!g||!c||!n)return;
    const classId=`${g}-${c}`;
    const deviceId=`${classId}-${String(n).padStart(2,'0')}`;
    const profile={grade:g,classNumber:c,seatNumber:n,classId,deviceId,label:`${g}年${c}組 ${n}番`,updatedAt:new Date().toISOString()};
    localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));
    localStorage.setItem(DEVICE_KEY,deviceId);
    location.href='index.html';
  });
})();
