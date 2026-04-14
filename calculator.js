/* ══════════════════════════════════════
   SHIELD — calculator.js (v4 — 바울 카드 + 펌제)
══════════════════════════════════════ */

/* ── 공통 유틸 ── */
function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

/* ══════════════════════════════
   염모제 계산기
══════════════════════════════ */
var DyeState = { total:120, oxi:1, rnd:1, bowls:[], bid:0, eid:0, max:3, maxEx:3 };

function initCalc(){
  DyeState.bid=1;
  DyeState.bowls=[{id:1,extras:[]}];
  dyeBindBowl(1);
  dyeBindGlobal();
  dyeCalcAll();
}

function dyeBindGlobal(){
  document.querySelectorAll('#page-calculator .gram-btn').forEach(function(b){
    b.addEventListener('click',function(){
      DyeState.total=parseInt(b.dataset.gram);
      document.getElementById('calc-custom-input').value='';
      document.querySelectorAll('#page-calculator .gram-btn').forEach(function(x){x.classList.remove('active')});
      b.classList.add('active');
      dyeCalcAll();
    });
  });
  document.getElementById('calc-custom-input').addEventListener('input',function(){
    var v=parseFloat(this.value);
    if(v>0){DyeState.total=v;document.querySelectorAll('#page-calculator .gram-btn').forEach(function(x){x.classList.remove('active')});dyeCalcAll();}
  });
  document.querySelectorAll('.oxi-btn').forEach(function(b){
    b.addEventListener('click',function(){
      DyeState.oxi=parseFloat(b.dataset.oxi);
      document.querySelectorAll('.oxi-btn').forEach(function(x){x.classList.remove('active')});
      b.classList.add('active');
      dyeCalcAll();
    });
  });
  document.querySelectorAll('.round-btn').forEach(function(b){
    b.addEventListener('click',function(){
      DyeState.rnd=parseFloat(b.dataset.round);
      document.querySelectorAll('.round-btn').forEach(function(x){x.classList.remove('active')});
      b.classList.add('active');
      dyeCalcAll();
    });
  });
  document.getElementById('dye-add-bowl-btn').addEventListener('click',dyeAddBowl);
}

function dyeBindBowl(id){
  var c=document.getElementById('dye-bowl-'+id);
  if(!c)return;
  c.querySelectorAll('.bowl-color-name,.bowl-ratio-input').forEach(function(el){el.addEventListener('input',dyeCalcAll);});
}

function dyeRnd(v){var m=DyeState.rnd;return Math.round(v/m)*m;}

function dyeAddBowl(){
  if(DyeState.bowls.length>=DyeState.max){showToast('바울은 최대 '+DyeState.max+'개');return;}
  DyeState.bid++;
  var id=DyeState.bid, num=DyeState.bowls.length+1;
  DyeState.bowls.push({id:id,extras:[]});
  var h='<div class="bowl-card" id="dye-bowl-'+id+'">'+
    '<div class="bowl-header"><div class="bowl-number">'+num+'</div><span class="bowl-title">바울 '+num+'</span><span class="bowl-summary" id="dye-bowl-'+id+'-summary"></span><button class="bowl-remove-btn" onclick="dyeRemoveBowl('+id+')">삭제</button></div>'+
    '<div class="bowl-color-list">'+
      bowlRowHTML(id,1,'')+bowlRowHTML(id,2,':')+bowlRowHTML(id,3,':')+
    '</div>'+
    '<div class="bowl-extras-section" style="display:none;"><div class="bowl-extras-divider"></div><div class="bowl-extras-label">추가제 (염모제 총량 기준 %)</div><div class="bowl-extras-list"></div></div>'+
    '<button class="bowl-add-extra-btn" onclick="dyeAddExtra('+id+')">+ 추가</button>'+
    '<div class="bowl-total-bar" id="dye-bowl-'+id+'-total"><div class="bowl-total-empty">염모제를 입력하세요</div></div>'+
  '</div>';
  document.getElementById('dye-add-bowl-btn').insertAdjacentHTML('beforebegin',h);
  dyeBindBowl(id);
  dyeUpdateBtn();
  dyeCalcAll();
}

function bowlRowHTML(bid,n,sep){
  return '<div class="bowl-color-row"><input class="calc-input bowl-color-name" type="text" placeholder="염모제 '+n+'"/><div class="bowl-ratio-wrap">'+(sep?'<span class="bowl-ratio-sep">'+sep+'</span>':'')+'<input class="calc-input bowl-ratio-input" type="number" placeholder="비율" min="0" inputmode="decimal"/></div><span class="bowl-color-gram">—</span></div>';
}

function dyeRemoveBowl(id){
  DyeState.bowls=DyeState.bowls.filter(function(b){return b.id!==id});
  var el=document.getElementById('dye-bowl-'+id);if(el)el.remove();
  document.querySelectorAll('#dye-bowls-container .bowl-card').forEach(function(c,i){
    c.querySelector('.bowl-number').textContent=i+1;
    c.querySelector('.bowl-title').textContent='바울 '+(i+1);
  });
  dyeUpdateBtn();dyeCalcAll();
}

function dyeUpdateBtn(){
  var b=document.getElementById('dye-add-bowl-btn');
  if(DyeState.bowls.length>=DyeState.max){b.style.display='none';}
  else{b.style.display='block';b.textContent='+ 바울 '+(DyeState.bowls.length+1)+' 추가';}
}

function dyeAddExtra(bowlId){
  var bowl=DyeState.bowls.find(function(b){return b.id===bowlId});
  if(!bowl||bowl.extras.length>=DyeState.maxEx){showToast('추가 제품은 최대 '+DyeState.maxEx+'개');return;}
  DyeState.eid++;
  var eid='de-'+DyeState.eid;
  bowl.extras.push({id:eid,name:'',pct:0,inOxi:false});
  var card=document.getElementById('dye-bowl-'+bowlId);
  card.querySelector('.bowl-extras-section').style.display='block';
  var list=card.querySelector('.bowl-extras-list');
  var row=document.createElement('div');row.className='bowl-extra-row';row.id='row-'+eid;
  row.innerHTML='<div class="bowl-extra-row-top"><input class="calc-input bowl-extra-name" type="text" placeholder="제품명"/><div class="bowl-extra-pct-wrap"><input class="calc-input bowl-extra-pct" type="number" placeholder="%" min="0" inputmode="decimal"/><span class="bowl-extra-pct-label">%</span></div><span class="bowl-extra-gram" id="gram-'+eid+'">—</span><button class="bowl-extra-remove" onclick="dyeRemoveExtra('+bowlId+',\''+eid+'\')">×</button></div><label class="bowl-oxi-include-label"><input type="checkbox" class="bowl-oxi-include-chk"/><span class="bowl-oxi-include-text">산화제 비율에 포함</span></label>';
  row.querySelector('.bowl-extra-name').addEventListener('input',function(){var e=bowl.extras.find(function(x){return x.id===eid});if(e)e.name=this.value;dyeCalcAll();});
  row.querySelector('.bowl-extra-pct').addEventListener('input',function(){var e=bowl.extras.find(function(x){return x.id===eid});if(e)e.pct=parseFloat(this.value)||0;dyeCalcAll();});
  row.querySelector('.bowl-oxi-include-chk').addEventListener('change',function(){var e=bowl.extras.find(function(x){return x.id===eid});if(e)e.inOxi=this.checked;dyeCalcAll();});
  list.appendChild(row);dyeCalcAll();
}

function dyeRemoveExtra(bowlId,eid){
  var bowl=DyeState.bowls.find(function(b){return b.id===bowlId});if(!bowl)return;
  bowl.extras=bowl.extras.filter(function(e){return e.id!==eid});
  var r=document.getElementById('row-'+eid);if(r)r.remove();
  if(bowl.extras.length===0){var card=document.getElementById('dye-bowl-'+bowlId);card.querySelector('.bowl-extras-section').style.display='none';}
  dyeCalcAll();
}

function dyeCalcAll(){DyeState.bowls.forEach(function(b){dyeCalcBowl(b);});}

function dyeCalcBowl(bowl){
  var total=DyeState.total,id=bowl.id;
  var card=document.getElementById('dye-bowl-'+id);if(!card)return;
  var rows=card.querySelectorAll('.bowl-color-row'),gspans=card.querySelectorAll('.bowl-color-gram');
  var colors=[];
  rows.forEach(function(r,i){
    var nm=r.querySelector('.bowl-color-name').value.trim();
    var rt=parseFloat(r.querySelector('.bowl-ratio-input').value)||0;
    colors.push({name:nm,ratio:rt,idx:i});
  });
  var active=colors.filter(function(c){return c.name||c.ratio>0});
  var rsum=active.reduce(function(s,c){return s+c.ratio},0);
  if(rsum===0&&active.length>0){active.forEach(function(c){c.ratio=1});rsum=active.length;}
  var gmap={};
  active.forEach(function(c){c.gram=active.length===1?total:dyeRnd(c.ratio/rsum*total);gmap[c.idx]=c.gram;});
  var mainT=active.reduce(function(s,c){return s+c.gram},0);
  gspans.forEach(function(sp,i){if(gmap[i]!==undefined){sp.textContent=gmap[i]+'g';sp.style.color='#1A1814';}else{sp.textContent='—';sp.style.color='#ccc';}});

  var exItems=[];
  bowl.extras.forEach(function(e){
    var g=e.pct>0?dyeRnd(mainT*e.pct/100):0;
    exItems.push({id:e.id,name:e.name||'추가제품',pct:e.pct,gram:g,inOxi:e.inOxi});
    var gel=document.getElementById('gram-'+e.id);if(gel)gel.textContent=e.pct>0?g+'g':'—';
  });
  var exT=exItems.reduce(function(s,e){return s+e.gram},0);
  var oxiBase=mainT;exItems.forEach(function(e){if(e.inOxi)oxiBase+=e.gram;});
  var oxiG=dyeRnd(oxiBase*DyeState.oxi);
  var grand=mainT+oxiG+exT;

  var sumEl=document.getElementById('dye-bowl-'+id+'-summary');
  if(sumEl)sumEl.textContent=active.length>0?'염모제 '+mainT+'g + 산화제 '+oxiG+'g':'';

  var bar=document.getElementById('dye-bowl-'+id+'-total');
  if(active.length===0){bar.innerHTML='<div class="bowl-total-empty">염모제를 입력하세요</div>';return;}

  var bIdx=DyeState.bowls.indexOf(bowl)+1;
  var h='<div class="bowl-res-label">바울 '+bIdx+' 계산 결과</div>';
  if(active.length>1){
    h+='<div class="bowl-res-ratio">'+active.map(function(c){return esc(c.name)}).join(' : ')+' = '+active.map(function(c){return c.ratio}).join(' : ')+'</div>';
  }
  active.forEach(function(c){h+='<div class="bowl-res-item"><span class="name">'+esc(c.name)+'</span><span class="gram">'+c.gram+'g</span></div>';});

  // 염모제(1제) 총량
  h+='<div class="bowl-res-divider"></div>';
  h+='<div class="bowl-res-main-total"><span>염모제(1제) 총량 =</span><span>'+mainT+'g</span></div>';

  // 추가제
  if(exItems.length>0){
    h+='<div class="bowl-res-divider"></div>';
    exItems.forEach(function(e){
      var tag=e.inOxi?'<span class="bowl-res-oxi-tag">산화제포함</span>':'';
      h+='<div class="bowl-res-item"><span class="name">'+esc(e.name)+' ('+e.pct+'%)'+tag+'</span><span class="gram">'+e.gram+'g</span></div>';
    });
  }

  // 산화제
  h+='<div class="bowl-res-divider"></div>';
  var oxiLabel='산화제 (1:'+DyeState.oxi+')';
  if(oxiBase!==mainT)oxiLabel+=' 기준 '+oxiBase+'g';
  h+='<div class="bowl-res-oxi"><span>'+oxiLabel+'</span><span>'+oxiG+'g</span></div>';

  // 바울 합계
  h+='<div class="bowl-res-grand"><span class="label">바울 합계</span><span class="total">'+grand+'g</span></div>';
  bar.innerHTML=h;
}


/* ══════════════════════════════
   펌제 계산기
══════════════════════════════ */
var PermState = { total:120, rnd:1, bowls:[], bid:0, eid:0, max:3, maxEx:3 };

function initPermCalc(){
  PermState.bid=1;
  PermState.bowls=[{id:1,extras:[]}];
  permBindBowl(1);
  permBindGlobal();
  permCalcAll();
}

function permBindGlobal(){
  document.querySelectorAll('.perm-gram-btn').forEach(function(b){
    b.addEventListener('click',function(){
      PermState.total=parseInt(b.dataset.gram);
      document.getElementById('perm-custom-input').value='';
      document.querySelectorAll('.perm-gram-btn').forEach(function(x){x.classList.remove('active')});
      b.classList.add('active');
      permCalcAll();
    });
  });
  document.getElementById('perm-custom-input').addEventListener('input',function(){
    var v=parseFloat(this.value);
    if(v>0){PermState.total=v;document.querySelectorAll('.perm-gram-btn').forEach(function(x){x.classList.remove('active')});permCalcAll();}
  });
  document.querySelectorAll('.perm-round-btn').forEach(function(b){
    b.addEventListener('click',function(){
      PermState.rnd=parseFloat(b.dataset.round);
      document.querySelectorAll('.perm-round-btn').forEach(function(x){x.classList.remove('active')});
      b.classList.add('active');
      permCalcAll();
    });
  });
  document.getElementById('perm-add-bowl-btn').addEventListener('click',permAddBowl);
}

function permBindBowl(id){
  var c=document.getElementById('perm-bowl-'+id);if(!c)return;
  c.querySelectorAll('.bowl-color-name,.bowl-ratio-input').forEach(function(el){el.addEventListener('input',permCalcAll);});
}

function permRnd(v){var m=PermState.rnd;return Math.round(v/m)*m;}

function permAddBowl(){
  if(PermState.bowls.length>=PermState.max){showToast('바울은 최대 '+PermState.max+'개');return;}
  PermState.bid++;
  var id=PermState.bid,num=PermState.bowls.length+1;
  PermState.bowls.push({id:id,extras:[]});
  var h='<div class="bowl-card" id="perm-bowl-'+id+'">'+
    '<div class="bowl-header"><div class="bowl-number">'+num+'</div><span class="bowl-title">바울 '+num+'</span><span class="bowl-summary" id="perm-bowl-'+id+'-summary"></span><button class="bowl-remove-btn" onclick="permRemoveBowl('+id+')">삭제</button></div>'+
    '<div class="bowl-color-list">'+
      permRowHTML(id,1,'')+permRowHTML(id,2,':')+permRowHTML(id,3,':')+
    '</div>'+
    '<div class="bowl-extras-section" style="display:none;"><div class="bowl-extras-divider"></div><div class="bowl-extras-label">추가제 (펌제 총량 기준 %)</div><div class="bowl-extras-list"></div></div>'+
    '<button class="bowl-add-extra-btn" onclick="permAddExtra('+id+')">+ 추가</button>'+
    '<div class="bowl-total-bar" id="perm-bowl-'+id+'-total"><div class="bowl-total-empty">펌제를 입력하세요</div></div>'+
  '</div>';
  document.getElementById('perm-add-bowl-btn').insertAdjacentHTML('beforebegin',h);
  permBindBowl(id);permUpdateBtn();permCalcAll();
}

function permRowHTML(bid,n,sep){
  return '<div class="bowl-color-row"><input class="calc-input bowl-color-name" type="text" placeholder="펌제 '+n+'"/><div class="bowl-ratio-wrap">'+(sep?'<span class="bowl-ratio-sep">'+sep+'</span>':'')+'<input class="calc-input bowl-ratio-input" type="number" placeholder="비율" min="0" inputmode="decimal"/></div><span class="bowl-color-gram">—</span></div>';
}

function permRemoveBowl(id){
  PermState.bowls=PermState.bowls.filter(function(b){return b.id!==id});
  var el=document.getElementById('perm-bowl-'+id);if(el)el.remove();
  document.querySelectorAll('#perm-bowls-container .bowl-card').forEach(function(c,i){
    c.querySelector('.bowl-number').textContent=i+1;
    c.querySelector('.bowl-title').textContent='바울 '+(i+1);
  });
  permUpdateBtn();permCalcAll();
}

function permUpdateBtn(){
  var b=document.getElementById('perm-add-bowl-btn');
  if(PermState.bowls.length>=PermState.max){b.style.display='none';}
  else{b.style.display='block';b.textContent='+ 바울 '+(PermState.bowls.length+1)+' 추가';}
}

function permAddExtra(bowlId){
  var bowl=PermState.bowls.find(function(b){return b.id===bowlId});
  if(!bowl||bowl.extras.length>=PermState.maxEx){showToast('추가 제품은 최대 '+PermState.maxEx+'개');return;}
  PermState.eid++;
  var eid='pe-'+PermState.eid;
  bowl.extras.push({id:eid,name:'',pct:0});
  var card=document.getElementById('perm-bowl-'+bowlId);
  card.querySelector('.bowl-extras-section').style.display='block';
  var list=card.querySelector('.bowl-extras-list');
  var row=document.createElement('div');row.className='bowl-extra-row';row.id='row-'+eid;
  row.innerHTML='<div class="bowl-extra-row-top"><input class="calc-input bowl-extra-name" type="text" placeholder="제품명"/><div class="bowl-extra-pct-wrap"><input class="calc-input bowl-extra-pct" type="number" placeholder="%" min="0" inputmode="decimal"/><span class="bowl-extra-pct-label">%</span></div><span class="bowl-extra-gram" id="gram-'+eid+'">—</span><button class="bowl-extra-remove" onclick="permRemoveExtra('+bowlId+',\''+eid+'\')">×</button></div>';
  row.querySelector('.bowl-extra-name').addEventListener('input',function(){var e=bowl.extras.find(function(x){return x.id===eid});if(e)e.name=this.value;permCalcAll();});
  row.querySelector('.bowl-extra-pct').addEventListener('input',function(){var e=bowl.extras.find(function(x){return x.id===eid});if(e)e.pct=parseFloat(this.value)||0;permCalcAll();});
  list.appendChild(row);permCalcAll();
}

function permRemoveExtra(bowlId,eid){
  var bowl=PermState.bowls.find(function(b){return b.id===bowlId});if(!bowl)return;
  bowl.extras=bowl.extras.filter(function(e){return e.id!==eid});
  var r=document.getElementById('row-'+eid);if(r)r.remove();
  if(bowl.extras.length===0){document.getElementById('perm-bowl-'+bowlId).querySelector('.bowl-extras-section').style.display='none';}
  permCalcAll();
}

function permCalcAll(){PermState.bowls.forEach(function(b){permCalcBowl(b);});}

function permCalcBowl(bowl){
  var total=PermState.total,id=bowl.id;
  var card=document.getElementById('perm-bowl-'+id);if(!card)return;
  var rows=card.querySelectorAll('.bowl-color-row'),gspans=card.querySelectorAll('.bowl-color-gram');
  var colors=[];
  rows.forEach(function(r,i){
    var nm=r.querySelector('.bowl-color-name').value.trim();
    var rt=parseFloat(r.querySelector('.bowl-ratio-input').value)||0;
    colors.push({name:nm,ratio:rt,idx:i});
  });
  var active=colors.filter(function(c){return c.name||c.ratio>0});
  var rsum=active.reduce(function(s,c){return s+c.ratio},0);
  if(rsum===0&&active.length>0){active.forEach(function(c){c.ratio=1});rsum=active.length;}
  var gmap={};
  active.forEach(function(c){c.gram=active.length===1?total:permRnd(c.ratio/rsum*total);gmap[c.idx]=c.gram;});
  var mainT=active.reduce(function(s,c){return s+c.gram},0);
  gspans.forEach(function(sp,i){if(gmap[i]!==undefined){sp.textContent=gmap[i]+'g';sp.style.color='#1A1814';}else{sp.textContent='—';sp.style.color='#ccc';}});

  var exItems=[];
  bowl.extras.forEach(function(e){
    var g=e.pct>0?permRnd(mainT*e.pct/100):0;
    exItems.push({name:e.name||'추가제품',pct:e.pct,gram:g});
    var gel=document.getElementById('gram-'+e.id);if(gel)gel.textContent=e.pct>0?g+'g':'—';
  });
  var exT=exItems.reduce(function(s,e){return s+e.gram},0);
  var grand=mainT+exT;

  var sumEl=document.getElementById('perm-bowl-'+id+'-summary');
  if(sumEl)sumEl.textContent=active.length>0?'펌제 '+mainT+'g':'';

  var bar=document.getElementById('perm-bowl-'+id+'-total');
  if(active.length===0){bar.innerHTML='<div class="bowl-total-empty">펌제를 입력하세요</div>';return;}

  var bIdx=PermState.bowls.indexOf(bowl)+1;
  var h='<div class="bowl-res-label">바울 '+bIdx+' 계산 결과</div>';
  if(active.length>1){
    h+='<div class="bowl-res-ratio">'+active.map(function(c){return esc(c.name)}).join(' : ')+' = '+active.map(function(c){return c.ratio}).join(' : ')+'</div>';
  }
  active.forEach(function(c){h+='<div class="bowl-res-item"><span class="name">'+esc(c.name)+'</span><span class="gram">'+c.gram+'g</span></div>';});

  // 펌제(1제) 총량
  h+='<div class="bowl-res-divider"></div>';
  h+='<div class="bowl-res-main-total"><span>펌제(1제) 총량 =</span><span>'+mainT+'g</span></div>';

  // 추가제
  if(exItems.length>0){
    h+='<div class="bowl-res-divider"></div>';
    exItems.forEach(function(e){
      h+='<div class="bowl-res-item"><span class="name">'+esc(e.name)+' ('+e.pct+'%)</span><span class="gram">'+e.gram+'g</span></div>';
    });
  }

  // 바울 합계 (산화제 없음)
  h+='<div class="bowl-res-grand"><span class="label">바울 합계</span><span class="total">'+grand+'g</span></div>';
  bar.innerHTML=h;
}
