(()=>{
function animate(id,kind){const x=document.getElementById(id);if(!x)return;x.classList.remove('correct','wrong','bump');void x.offsetWidth;x.classList.add(kind)}
function celebrate(count){if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const root=document.getElementById('celebration');for(let i=0;i<count;i++){const star=document.createElement('span');star.className='confetti';star.textContent=i%3?'★':'✦';star.style.left=(18+Math.random()*64)+'%';star.style.color=['#edbc51','#b798e4','#6dbfea','#f2b382'][i%4];star.style.animationDelay=(Math.random()*.15)+'s';star.style.fontSize=(14+Math.random()*17)+'px';root.append(star);setTimeout(()=>star.remove(),1600)}}
window.addEventListener('kuku-feedback',e=>{const d=e.detail;if(d.type==='correct'){animate(d.answer,'correct');animate(d.score,'bump');celebrate(9)}else if(d.type==='wrong'){animate(d.answer,'wrong')}else if(d.type==='finish')celebrate(25)});
})();
