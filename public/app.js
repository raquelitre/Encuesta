// === Config ===
const API_BASE = '';                  // mismo origen
const SITE_URL = location.origin;

// === Ítems ===
const items = [
  "Creo que la ley no debe permitir partidos que busquen la ruptura de España",
  "Creo que en España se pagan demasiados impuestos",
  "Creo que hay que quitar pagas vitalicias y aforamientos a políticos",
  "Pienso que los ilegales que cometan delitos deben ser devueltos a sus países",
  "No quiero en España culturas que denigran a la mujer",
  "Apoyo la prisión permanente para los violadores de mujeres",
  "Opino que hombres y mujeres no somos enemigos",
  "Creo que hay que reforzar la vigilancia en nuestras fronteras",
  "Pienso que los okupas deben ser expulsados de inmediato",
  "Apoyo nuestro producto e industria frente a la competencia desleal",
  "Hay que endurecer las penas para los criminales",
  "Apoyo que los padres elijan la educación de sus hijos",
  "Pienso que hay que conservar las tradiciones que nos unen",
  "Apoyo un Sistema Sanitario y Educativo público común en España",
  "Me gusta la bandera de España y no me avergüenzo de ella",
  "Las instituciones públicas deben reducir el gasto político",
  "Pienso que hay que garantizar la libertad de hablar en español",
  "Respeto la identidad y orientación de cada persona, pero creo que en el deporte femenino no deben competir hombres biológicos aunque se identifiquen como mujeres.",
  "Creo que la Policía y la Guardia Civil deberían tener más medios",
  "Quiero que el bipartidismo deje de politizar la Justicia"
];

// === Helpers ===
const $ = (sel,root=document)=>root.querySelector(sel);
const $$= (sel,root=document)=>Array.from(root.querySelectorAll(sel));

// === Render y eventos ===
document.addEventListener('DOMContentLoaded', () => {
  // Render de tarjetas
  const grid = $('#grid');
  grid.innerHTML = items.map((t,i)=>{
    const id = `i${i+1}`;
    return `
      <div class="card">
        <input type="checkbox" id="${id}">
        <label class="card-body" for="${id}">
          <img src="img/${i+1}.png" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
          <span>${t}</span>
        </label>
      </div>
    `;
  }).join('');

  // Listeners compartir
  $('#share-x')  ?.addEventListener('click', ()=>shareTo('x'));
  $('#share-wh')?.addEventListener('click', ()=>shareTo('wh'));
  $('#share-tg')?.addEventListener('click', ()=>shareTo('tg'));
  $('#share-fb')?.addEventListener('click', ()=>shareTo('fb'));
  $('#share-ig')?.addEventListener('click', ()=>shareTo('ig'));

  // Descargar (arriba e inferior)
  $('#download-img')   ?.addEventListener('click', (e)=>{e.preventDefault(); downloadImage();});
  $('#download-bottom')?.addEventListener('click', (e)=>{e.preventDefault(); downloadImage();});

  // Reiniciar
  $('#reset')?.addEventListener('click', ()=>{
    $$('input[type="checkbox"]').forEach(c=>c.checked=false);
    update();
    history.replaceState({},'',location.pathname);
  });

  // Cambios en la encuesta
  $('#form').addEventListener('change', update);

  // Estado desde ?s=
  const s=new URL(location.href).searchParams.get('s'); if(s && s.length===20) setBits(s);

  // Pintar inicial
  update();
});

// === Donut / porcentaje ===
const R=52, CIRC=2*Math.PI*R;
function getChecked(){ return $$('input[type="checkbox"]:checked', $('#grid')).length; }
function getBits(){ return $$('input[type="checkbox"]', $('#grid')).map(c=>c.checked?'1':'0').join(''); }
function setBits(bits){ $$('input[type="checkbox"]', $('#grid')).forEach((c,i)=> c.checked = bits[i]==='1'); }

function update(){
  const p = Math.min(getChecked()*5,100);
  $('#arc').setAttribute('stroke-dasharray', `${(p/100)*CIRC} ${CIRC}`);
  $('#percent').textContent = `${p}%`;
  $('#subtitle')?.textContent = `Porcentaje de coincidencia`;  // texto visible
  document.title = `Coincidencia ${p}%`;
}

function keepUrl(){
  const url=new URL(location.href);
  url.searchParams.set('s', getBits());
  history.replaceState(null,'',url.toString());
  return url.toString();
}

// === Canvas para compartir/descargar ===
function drawShareCanvas(perc){
  const W=1200,H=630, c=document.createElement('canvas'); c.width=W; c.height=H; const ctx=c.getContext('2d');
  const stripe=H/3;
  ctx.fillStyle='#aa151b'; ctx.fillRect(0,0,W,stripe);
  ctx.fillStyle='#f1bf00'; ctx.fillRect(0,stripe,W,stripe);
  ctx.fillStyle='#aa151b'; ctx.fillRect(0,2*stripe,W,stripe);

  ctx.fillStyle='#ffffff'; ctx.font='bold 64px system-ui,-apple-system,Segoe UI,Roboto'; ctx.fillText('Encuesta rápida',60,110);
  ctx.fillStyle='#111827'; ctx.font='bold 76px system-ui,-apple-system,Segoe UI,Roboto';
  ctx.fillText(`Coincidencia facha: ${perc}%`,60,240);

  const cx=220, cy=420, r=120, start=-Math.PI/2, end=start+(2*Math.PI)*(perc/100);
  ctx.strokeStyle='#e5e7eb'; ctx.lineWidth=30; ctx.lineCap='round'; ctx.beginPath(); ctx.arc(cx,cy,r,0,2*Math.PI); ctx.stroke();
  ctx.strokeStyle='#63AF2B'; ctx.beginPath(); ctx.arc(cx,cy,r,start,end); ctx.stroke();

  ctx.fillStyle='#111827'; ctx.font='bold 72px system-ui,-apple-system,Segoe UI,Roboto';
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(`${perc}%`,cx,cy);

  ctx.textAlign='left'; ctx.textBaseline='alphabetic'; ctx.font='32px system-ui,-apple-system,Segoe UI,Roboto'; ctx.fillStyle='#000';
  ctx.fillText('Haz tu encuesta aquí:',60,300);
  ctx.font='bold 36px system-ui,-apple-system,Segoe UI,Roboto'; ctx.fillText(SITE_URL,60,340);
  return c;
}

// === Registro en backend (opcional) ===
async function logEvent(perc, action){
  try{
    await fetch(`${API_BASE}/api/share`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ bits:getBits(), percent: perc, user_agent: navigator.userAgent, action }),
      keepalive:true
    });
  }catch(_){}
}

// === Compartir/descargar ===
const shareText = (p,u,img)=> img?`Coincidencia facha: ${p}%\nHaz tu encuesta aquí: ${u}\nImagen: ${img}`:`Coincidencia facha: ${p}%\nHaz tu encuesta aquí: ${u}`;

async function toBase64(c){ const b=await new Promise(r=>c.toBlob(r,'image/png',0.95)); return await new Promise(res=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result.split(',')[1]); fr.readAsDataURL(b); }); }
async function upload(c){
  try{
    const image_base64 = await toBase64(c);
    const r = await fetch(`${API_BASE}/api/share-image`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({image_base64})});
    if(!r.ok) throw 0; const j=await r.json(); return j.url;
  }catch(_){ return ''; }
}

async function shareTo(net){
  const perc = Math.min(getChecked()*5,100);
  await logEvent(perc,'share');
  const url = keepUrl();
  const canvas = drawShareCanvas(perc);

  try{
    const blob = await new Promise(r=>canvas.toBlob(r,'image/png',0.95));
    const file = new File([blob], `resultado_${perc}.png`, {type:'image/png'});
    if (navigator.canShare && navigator.canShare({files:[file]}) && (net==='x'||net==='ig')){
      await navigator.share({title:'Encuesta', text:`Coincidencia facha: ${perc}% · ${url}`, files:[file]});
      return;
    }
  }catch(_){}

  const imgUrl = await upload(canvas);
  const message = shareText(perc, url, imgUrl);
  const encM = encodeURIComponent(message);
  const encU = encodeURIComponent(url);
  let href=url;
  if(net==='x')  href=`https://twitter.com/intent/tweet?text=${encM}`;
  if(net==='wh') href=`https://api.whatsapp.com/send?text=${encM}`;
  if(net==='tg') href=`https://t.me/share/url?url=${encU}&text=${encM}`;
  if(net==='fb') href=`https://www.facebook.com/sharer/sharer.php?u=${encU}`;
  if(net==='ig'){
    try{ await navigator.clipboard.writeText(message);}catch(_){}
    const a=document.createElement('a'); a.download=`resultado_${perc}.png`; a.href=canvas.toDataURL('image/png'); a.click();
    alert('Se copió el texto y se descargó la imagen. Súbela a Instagram manualmente.');
    return;
  }
  window.open(href,'_blank');
}

async function downloadImage(){
  const perc = Math.min(getChecked()*5,100);
  await logEvent(perc,'download');
  const canvas = drawShareCanvas(perc);
  const a=document.createElement('a');
  a.download=`resultado_${perc}.png`;
  a.href=canvas.toDataURL('image/png');
  a.click();
}
