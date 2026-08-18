(() => {
  const weatherButtons=[...document.querySelectorAll('.weather')];
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
})();
