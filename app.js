'use strict';
const $ = (s) => document.querySelector(s);
const labels = {pcgs:'PCGS',hac:'HAC++',light:'LightGaussian',meson:'MesonGS',gt:'Ground truth',ours:'Ours'};
const scenes = {
  coast:{name:'Coast',scores:{gt:'∞',hac:'20.62',light:'16.62',meson:'21.44',pcgs:'20.63',ours:'27.04'}},
  bedroom:{name:'Bedroom',scores:{gt:'∞',hac:'20.30',light:'21.66',meson:'20.08',pcgs:'20.45',ours:'27.25'}},
  laboratory:{name:'Laboratory',scores:{gt:'∞',hac:'17.40',light:'18.69',meson:'20.59',pcgs:'17.33',ours:'25.87'}},
  garden:{name:'Garden',scores:{gt:'∞',hac:'15.71',light:'22.00',meson:'21.91',pcgs:'14.55',ours:'25.39'}}
};
let currentScene = 'coast';
function updateComparison() {
  const method = $('#baseline').value, scene = scenes[currentScene];
  for (const [id,m,detail] of [['compare-before',method,false],['compare-after','ours',false],['detail-before',method,true],['detail-after','ours',true]]) {
    const img = $('#'+id);
    img.src = `assets/${currentScene}-${m}${detail?'-detail':''}.webp`;
    img.alt = `${scene.name} ${detail?'enlarged regions':'panoramic reconstruction'} · ${labels[m]}`;
  }
  $('#baseline-badge').textContent = labels[method];
  $('#detail-label').textContent = labels[method];
  $('#scene-caption').textContent = `${scene.name} · ${labels[method]} ${scene.scores[method]} dB / Ours ${scene.scores.ours} dB`;
  $('#scene-panel').setAttribute('aria-labelledby','tab-'+currentScene);
}
function wireTabs(container,callback) {
  const tabs = [...document.querySelectorAll(container+' [role="tab"]')];
  tabs.forEach((tab,i) => {
    tab.addEventListener('click',() => {
      tabs.forEach(t => {const active=t===tab;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;});
      callback(tab);
    });
    tab.addEventListener('keydown',e => {
      let target;
      if(e.key==='ArrowRight') target=(i+1)%tabs.length;
      if(e.key==='ArrowLeft') target=(i+tabs.length-1)%tabs.length;
      if(e.key==='Home') target=0;
      if(e.key==='End') target=tabs.length-1;
      if(target!==undefined){e.preventDefault();tabs[target].focus();tabs[target].click();}
    });
  });
}
wireTabs('.scene-tabs',tab => {currentScene=tab.dataset.scene;updateComparison();});
$('#baseline').addEventListener('change',updateComparison);
$('#comparison-range').addEventListener('input',e => $('#compare-frame').style.setProperty('--position',e.target.value+'%'));
const dialog = $('#figure-dialog');
document.querySelectorAll('.figure-open').forEach(button => button.addEventListener('click',() => {
  $('#dialog-image').src = button.dataset.figure;
  $('#dialog-image').alt = button.dataset.caption;
  $('#figure-caption').textContent = button.dataset.caption;
  dialog.showModal();
}));
$('#close-dialog').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();}});

const metricConfig = {
  ws_psnr_db:{name:'WS-PSNR',unit:'dB',min:16,max:26,ticks:[16,18,20,22,24,26],digits:2},
  lpips:{name:'LPIPS',unit:'',min:.20,max:.48,ticks:[.20,.25,.30,.35,.40,.45],digits:3},
  v_psnr_db:{name:'V-PSNR',unit:'dB',min:17,max:28,ticks:[18,20,22,24,26,28],digits:2},
  ws_ssim:{name:'WS-SSIM',unit:'',min:.60,max:.80,ticks:[.60,.65,.70,.75,.80],digits:3}
};
let results=[],currentMetric='ws_psnr_db';
const ns = 'http://www.w3.org/2000/svg';
function svgNode(tag,attrs,text){const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs||{}))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;return n;}
function renderChart() {
  if(!results.length)return;
  const svg=$('#rd-chart'),cfg=metricConfig[currentMetric];svg.replaceChildren();
  svg.setAttribute('aria-label',`${cfg.name} versus logarithmic storage in MiB. Ours Q1–Q4 and competing methods averaged over 43 scenes.`);
  const L=78,R=922,T=28,B=335;
  const x=v=>L+(Math.log10(v)-Math.log10(1.5))/(Math.log10(40)-Math.log10(1.5))*(R-L);
  const y=v=>B-(v-cfg.min)/(cfg.max-cfg.min)*(B-T);
  const add=(tag,attrs,txt)=>{const node=svgNode(tag,attrs,txt);svg.append(node);return node;};
  cfg.ticks.forEach(t=>{add('line',{x1:L,x2:R,y1:y(t),y2:y(t),stroke:'#e7e7e0','stroke-width':1});add('text',{x:L-13,y:y(t)+4,'text-anchor':'end',fill:'#74796f','font-size':12},cfg.unit?t.toFixed(0):t.toFixed(2));});
  [2,5,10,20,40].forEach(t=>{add('text',{x:x(t),y:B+26,'text-anchor':'middle',fill:'#74796f','font-size':12},t);});
  add('line',{x1:L,x2:R,y1:B,y2:B,stroke:'#c9ccc0'});
  add('text',{x:(L+R)/2,y:395,'text-anchor':'middle',fill:'#74796f','font-size':12},'Mean storage (MiB) · logarithmic scale');
  add('text',{x:L,y:15,fill:'#74796f','font-size':12},cfg.name+(cfg.unit?` (${cfg.unit})`:''));
  const groups=[{key:'PCGS',color:'#648482',name:'PCGS'},{key:'HAC++',color:'#9a76ac',name:'HAC++'},{key:'LightGaussian',color:'#7c8baf',name:'LightGaussian'},{key:'MesonGS',color:'#b99d53',name:'MesonGS'},{key:'OUR',color:'#b94c26',name:'Ours'}];
  groups.forEach(g=>{
    const pts=results.filter(r=>r.method.startsWith(g.key)).sort((a,b)=>a.storage_mib-b.storage_mib);
    if(pts.length>1)add('polyline',{points:pts.map(r=>`${x(r.storage_mib)},${y(r[currentMetric])}`).join(' '),fill:'none',stroke:g.color,'stroke-width':g.key==='OUR'?3:2});
    pts.forEach((r,i)=>{
      const cx=x(r.storage_mib),cy=y(r[currentMetric]);
      const accessible=`${g.name} ${r.config}: ${r[currentMetric].toFixed(cfg.digits)} ${cfg.unit}, ${r.storage_mib.toFixed(3)} MiB`;
      const point=add('circle',{cx,cy,r:g.key==='OUR'?6:5,fill:g.color,stroke:'white','stroke-width':2,tabindex:0,role:'img','aria-label':accessible});
      point.append(svgNode('title',{},accessible));
      point.addEventListener('focus',()=>$('#chart-status').textContent=accessible);
      point.addEventListener('mouseenter',()=>$('#chart-status').textContent=accessible);
      if(g.key==='OUR')add('text',{x:cx+7,y:cy-12,fill:g.color,'font-size':12,'font-weight':600},'Q'+(i+1));
      else if(i===0)add('text',{x:cx+9,y:cy+(g.key==='PCGS'?23:-12),fill:g.color,'font-size':11},g.name);
    });
  });
  $('#chart-panel').setAttribute('aria-labelledby','metric-'+currentMetric);
  $('#chart-status').textContent='Hover over or focus a point to inspect its reported values.';
}
wireTabs('.metric-tabs',tab=>{currentMetric=tab.dataset.metric;renderChart();});
async function loadResults(){
  try{
    const response=await fetch('assets/results.json');if(!response.ok)throw new Error('Results unavailable');
    const data=await response.json();results=data.system;
    const body=$('#results-body');
    results.forEach(r=>{
      const tr=document.createElement('tr');
      if(r.method.startsWith('OUR'))tr.className='ours';
      const name=r.method.startsWith('OUR')?`Ours · ${r.method.replace('OUR ','')} (${r.config})`:r.method==='PCGS'?`PCGS · ${r.config}`:r.method;
      [name,r.storage_mib.toFixed(3),r.ws_psnr_db.toFixed(3),r.lpips.toFixed(4),r.ws_ssim.toFixed(4)].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});body.append(tr);
    });renderChart();
  }catch(e){$('#chart-status').replaceChildren();const a=document.createElement('a');a.href='assets/fig02_quality_storage.svg';a.textContent='View the original results figure';$('#chart-status').append('Interactive data could not load. ',a);}
}
loadResults();
