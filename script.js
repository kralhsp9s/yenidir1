(() => {
"use strict";

const COLORS = ["Kırmızı", "Siyah", "Mavi", "Sarı"];
const COLOR_CLASS = {"Kırmızı":"red","Siyah":"black","Mavi":"blue","Sarı":"yellow"};
const SYMBOL = {"Kırmızı":"●","Siyah":"●","Mavi":"●","Sarı":"●"};
const $ = id => document.getElementById(id);
const state = {
  players: [], dealer: 0, current: 0, indicator: null, okey: null,
  deck: [], discards: [], tableMelds: [], opened: new Set(),
  selected: new Set(), hasDrawn: false, gameOver: false, busy: false,
  lastDiscard: null, nextId: 1
};

function makeTiles() {
  const tiles = [];
  for (const color of COLORS) for (let n=1;n<=13;n++) for(let copy=0;copy<2;copy++) {
    tiles.push({id:state.nextId++, color, number:n, type:"normal"});
  }
  tiles.push({id:state.nextId++, color:null, number:null, type:"fake"});
  tiles.push({id:state.nextId++, color:null, number:null, type:"fake"});
  return tiles;
}
function shuffle(a) {
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function isJoker(t) { return !!t && t.type==="normal" && t.color===state.okey.color && t.number===state.okey.number; }
function value(t) { return t.type==="fake" ? state.okey.number : t.number; }
function tileEl(t, opts={}) {
  const el=document.createElement("div");
  el.className="tile"+(t.type==="fake"?" sfake":isJoker(t)?" joker":" "+(COLOR_CLASS[t.color]||""));
  el.dataset.id=t.id;
  el.innerHTML=t.type==="fake" ? `<span>★</span><span class="symbol">Sahte</span>` :
    `<span>${t.number}</span><span class="symbol">${SYMBOL[t.color]||"●"}</span>`;
  el.title=t.type==="fake"?"Sahte okey":`${t.color} ${t.number}${isJoker(t)?" (Okey)":""}`;
  if(opts.selectable) {
    el.draggable=true;
    el.tabIndex=0;
    if(state.selected.has(t.id)) el.classList.add("selected");
    el.addEventListener("click",()=>selectTile(t.id));
    el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selectTile(t.id);}});
    el.addEventListener("dragstart",e=>{
      state.dragId=t.id; el.classList.add("dragging");
      e.dataTransfer.setData("text/plain",String(t.id)); e.dataTransfer.effectAllowed="move";
    });
    el.addEventListener("dragend",()=>{state.dragId=null;el.classList.remove("dragging");document.querySelectorAll(".drop-target").forEach(x=>x.classList.remove("drop-target"));});
    el.addEventListener("dragover",e=>{e.preventDefault();el.classList.add("drop-target");});
    el.addEventListener("dragleave",()=>el.classList.remove("drop-target"));
    el.addEventListener("drop",e=>{e.preventDefault();el.classList.remove("drop-target");const from=Number(e.dataTransfer.getData("text/plain"));reorderTiles(from,t.id);});
  }
  return el;
}
function makeMeld(tiles) { const d=document.createElement("div");d.className="meld";tiles.forEach(t=>d.appendChild(tileEl(t)));return d; }

function newGame() {
  state.nextId=1; state.selected.clear(); state.opened=new Set(); state.tableMelds=[];
  state.discards=[];state.hasDrawn=false;state.gameOver=false;state.busy=false;
  let tiles=shuffle(makeTiles());
  // Gösterge normal taş olsun.
  const ix=tiles.findIndex(t=>t.type==="normal");
  state.indicator=tiles.splice(ix,1)[0];
  state.okey={color:state.indicator.color,number:state.indicator.number===13?1:state.indicator.number+1,type:"normal"};
  const dealer=Math.floor(Math.random()*4);
  state.dealer=dealer;
  state.players=Array.from({length:4},(_,i)=>({id:i,name:i===0?"Sen":`Bot ${i}`,human:i===0,hand:[],melds:[]}));
  // Dağıtıcı 22, diğerleri 21. İnsan oyuncunun elinde 22 varsa ilk taşı atar.
  for(let i=0;i<4;i++){
    const p=state.players[(dealer+i)%4], count=p.id===dealer?22:21;
    for(let j=0;j<count;j++)p.hand.push(tiles.pop());
  }
  state.deck=tiles;
  state.current=dealer;
  // Ortada taş yok; atılan taş alanı tur ilerledikçe dolar.
  render();
  setMessage(`Dağıtıcı ${state.players[dealer].name}. İlk sıra onda.`);
  if(state.current!==0) scheduleBotTurn(650);
  else setMessage("Sıra sende. Başlamak için ortadan taş çek veya yandan taşı al.");
}
function setMessage(msg){$("message").textContent=msg;}
function selectTile(id) {
  if(state.current!==0||state.busy||state.gameOver)return;
  if(!state.hasDrawn){setMessage("Önce ortadan taş çek veya yandan taşı al.");return;}
  if(state.selected.has(id))state.selected.delete(id);else state.selected.add(id);
  renderRack();
  $("selectedInfo").textContent=state.selected.size?`${state.selected.size} taş seçili`:"Seçili taş yok";
}
function reorderTiles(fromId,toId) {
  if(state.current!==0||state.busy)return;
  const hand=state.players[0].hand, a=hand.findIndex(t=>t.id===fromId), b=hand.findIndex(t=>t.id===toId);
  if(a<0||b<0||a===b)return;
  const [item]=hand.splice(a,1);hand.splice(b,0,item);renderRack();
}
function drawFromDeck() {
  if(state.current!==0||state.busy||state.gameOver||state.hasDrawn)return;
  if(!state.deck.length){setMessage("Çekme destesi boş. Yandan taş almayı deneyebilirsin.");return;}
  state.players[0].hand.push(state.deck.pop());state.hasDrawn=true;state.selected.clear();
  render();setMessage("Taş çektin. Per açabilir, yere işleyebilir ve bir taş atabilirsin.");
}
function takeDiscard() {
  if(state.current!==0||state.busy||state.gameOver||state.hasDrawn)return;
  if(!state.discards.length){setMessage("Yandan alınacak taş yok.");return;}
  state.players[0].hand.push(state.discards.pop());state.hasDrawn=true;state.selected.clear();
  render();setMessage("Yandan taşı aldın. Şimdi hamleni yap ve bir taş at.");
}
function isValidRun(tiles) {
  if(tiles.length<3 || tiles.length>13)return false;
  const jokers=tiles.filter(isJoker), normals=tiles.filter(t=>!isJoker(t));
  if(!normals.length)return false;
  const color=normals[0].color;
  if(normals.some(t=>t.color!==color))return false;
  const nums=normals.map(t=>t.number);
  if(new Set(nums).size!==nums.length)return false;

  // 1, 2, ... 13 döngüsü desteklenir; ör. 12-13-1 ve 13-1-2.
  for(let start=1;start<=13;start++){
    const sequence=Array.from({length:tiles.length},(_,i)=>((start+i-1)%13)+1);
    if(nums.every(n=>sequence.includes(n))){
      const missing=sequence.filter(n=>!nums.includes(n)).length;
      if(missing===jokers.length)return true;
    }
  }
  return false;
}
function isValidGroup(tiles) {
  if(tiles.length<3||tiles.length>4)return false;
  const normals=tiles.filter(t=>!isJoker(t));
  if(!normals.length)return false;
  const n=normals[0].number;
  return normals.every(t=>t.number===n)&&new Set(normals.map(t=>t.color)).size===normals.length&&tiles.length<=4;
}
function validMeld(tiles){return isValidRun(tiles)||isValidGroup(tiles);}
function combos(arr,k) {
  const out=[];
  function rec(start,chosen){if(chosen.length===k){out.push([...chosen]);return;}
    for(let i=start;i<arr.length;i++){chosen.push(arr[i]);rec(i+1,chosen);chosen.pop();}}
  rec(0,[]);return out;
}
function meldCandidates(hand) {
  const out=[];
  for(let k=3;k<=Math.min(13,hand.length);k++) {
    for(const c of combos(hand,k)) if(validMeld(c))out.push({tiles:c,value:c.reduce((s,t)=>s+value(t),0)});
    // Avoid combinatorial explosion in ordinary hands.
    if(out.length>1800)break;
  }
  return out.sort((a,b)=>b.value-a.value);
}
function bestMelds(hand) {
  const candidates=meldCandidates(hand), chosen=[], used=new Set();
  // Greedy non-overlapping selection: quick and suitable for the first playable version.
  for(const c of candidates) if(c.tiles.every(t=>!used.has(t.id))) {
    chosen.push(c.tiles);c.tiles.forEach(t=>used.add(t.id));
  }
  return chosen;
}
function pairsIn(hand) {
  const used=new Set(),pairs=[];
  for(let i=0;i<hand.length;i++) {
    if(used.has(hand[i].id)||hand[i].type!=="normal")continue;
    for(let j=i+1;j<hand.length;j++){
      const a=hand[i],b=hand[j];
      if(!used.has(b.id)&&b.type==="normal"&&a.color===b.color&&a.number===b.number){
        pairs.push([a,b]);used.add(a.id);used.add(b.id);break;
      }
    }
  }
  return pairs;
}
function openSelectedMelds() {
  const p=state.players[0];
  if(!state.hasDrawn){setMessage("El açmadan önce taş çekmelisin.");return;}
  const selected=p.hand.filter(t=>state.selected.has(t.id));
  if(selected.length<3){setMessage("Açmak için en az 3 taş seç.");return;}
  // Selected melds may contain multiple groups; split with greedy candidates.
  const melds=bestMelds(selected);
  const used=melds.flat();
  if(used.length!==selected.length){setMessage("Seçili taşların tamamı geçerli perlere ayrılmıyor.");return;}
  if(state.opened.has(0)){setMessage("Elini zaten açtın.");return;}
  const total=used.reduce((s,t)=>s+value(t),0);
  if(total<101){setMessage(`Seçili geçerli perlerin toplamı ${total}. Açmak için en az 101 gerekir.`);return;}
  commitOpen(p,melds,false);
}
function commitOpen(player,melds,isBot) {
  const used=melds.flat();
  for(const meld of melds) {
    player.melds.push([...meld]);
    state.tableMelds.push({playerId:player.id,tiles:[...meld],pair:false});
  }
  player.hand=player.hand.filter(t=>!used.some(u=>u.id===t.id));
  state.opened.add(player.id);state.selected.clear();
  if(!isBot) {render();setMessage(`El açtın. Açılan taşların toplamı ${used.reduce((s,t)=>s+value(t),0)}.`);}
}
function openPairsForBot(player) {
  const pairs=pairsIn(player.hand).slice(0,5);
  if(pairs.length<5)return false;
  for(const pair of pairs){player.melds.push([...pair]);state.tableMelds.push({playerId:player.id,tiles:[...pair],pair:true});}
  const used=pairs.flat();player.hand=player.hand.filter(t=>!used.some(u=>u.id===t.id));state.opened.add(player.id);return true;
}
function openBot(player) {
  const melds=bestMelds(player.hand),total=melds.flat().reduce((s,t)=>s+value(t),0);
  if(total>=101&&melds.length){commitOpen(player,melds,true);return true;}
  return openPairsForBot(player);
}
function processSelected() {
  if(state.current!==0||!state.hasDrawn||state.busy)return;
  if(!state.opened.has(0)){setMessage("Önce elini açmalısın.");return;}
  const p=state.players[0], ids=state.selected, selected=p.hand.filter(t=>ids.has(t.id));
  if(!selected.length){setMessage("Yere işleyeceğin taşı seç.");return;}
  let processed=0;
  for(const t of selected) {
    const target=state.tableMelds.find(m=>canAddToMeld(t,m.tiles));
    if(target) {
      target.tiles.push(t);
      const owner=state.players[target.playerId]; if(owner)owner.melds.push([t]);
      p.hand=p.hand.filter(x=>x.id!==t.id);processed++;ids.delete(t.id);
    }
  }
  render();setMessage(processed?`${processed} taş yere işlendi.`:"Seçili taşlardan hiçbiri mevcut perlere işlenemiyor.");
}
function canAddToMeld(tile,meld) {
  if(meld.length>=13)return false;
  return validMeld([...meld,tile]);
}
function discardSelected() {
  if(state.current!==0||!state.hasDrawn||state.busy||state.gameOver)return;
  const p=state.players[0];
  if(state.selected.size!==1){setMessage("Atmak için ıstakandan tam bir taş seç.");return;}
  const id=[...state.selected][0],idx=p.hand.findIndex(t=>t.id===id);
  if(idx<0)return;
  const [tile]=p.hand.splice(idx,1);state.discards.push(tile);state.lastDiscard=tile;
  state.selected.clear();state.hasDrawn=false;
  if(!p.hand.length){state.gameOver=true;render();setMessage("Tebrikler, elindeki taşlar bitti!");return;}
  state.current=(state.current+1)%4;
  render();setMessage(`${p.name} taş attı. Sıradaki: ${state.players[state.current].name}.`);
  if(state.current!==0)scheduleBotTurn(700);
}
function canAddToAnyTable(tile) {return state.tableMelds.some(m=>canAddToMeld(tile,m.tiles));}
function tileUseful(tile,hand) {
  const test=[...hand,tile];
  return meldCandidates(test).some(c=>c.tiles.some(t=>t.id===tile.id))||canAddToAnyTable(tile);
}
function chooseDiscard(hand) {
  if(!hand.length)return null;
  const candidates=meldCandidates(hand);
  const inMeld=new Set(candidates.flatMap(c=>c.tiles.map(t=>t.id)));
  function connection(t) {
    let score=0;
    for(const o of hand)if(o.id!==t.id&&o.type==="normal"&&t.type==="normal"){
      if(t.color===o.color&&Math.abs(t.number-o.number)<=2)score+=2;
      if(t.number===o.number&&t.color!==o.color)score+=2;
    }
    return score;
  }
  return [...hand].sort((a,b)=>{
    const ap=inMeld.has(a.id),bp=inMeld.has(b.id);
    if(ap!==bp)return ap?1:-1;
    const c=connection(a)-connection(b);
    if(c)return c;
    if(isJoker(a)!==isJoker(b))return isJoker(a)?1:-1;
    return value(b)-value(a);
  })[0];
}
function botTurn() {
  if(state.gameOver||state.current===0)return;
  const p=state.players[state.current];state.busy=true;render();
  const top=state.discards[state.discards.length-1];
  if(top&&tileUseful(top,p.hand))p.hand.push(state.discards.pop());
  else if(state.deck.length)p.hand.push(state.deck.pop());
  else if(top)p.hand.push(state.discards.pop());
  else {state.gameOver=true;state.busy=false;setMessage("Çekilecek taş kalmadı.");render();return;}
  if(!state.opened.has(p.id))openBot(p);
  if(state.opened.has(p.id)) {
    // Add one eligible tile at a time to existing table melds.
    for(let i=p.hand.length-1;i>=0;i--){
      const t=p.hand[i],m=state.tableMelds.find(x=>canAddToMeld(t,x.tiles));
      if(m){m.tiles.push(t);p.hand.splice(i,1);}
    }
  }
  const discard=chooseDiscard(p.hand);
  if(discard){p.hand=p.hand.filter(t=>t.id!==discard.id);state.discards.push(discard);state.lastDiscard=discard;}
  if(!p.hand.length){state.gameOver=true;state.busy=false;render();setMessage(`${p.name} oyunu bitirdi.`);return;}
  state.current=(state.current+1)%4;state.busy=false;state.hasDrawn=false;render();
  if(state.current===0)setMessage("Sıra sende. Ortadan taş çek veya son atılanı yandan al.");
  else scheduleBotTurn(700);
}
function scheduleBotTurn(delay) {
  if(state.gameOver)return;
  state.busy=true;render();
  setTimeout(()=>{state.busy=false;if(state.current!==0)botTurn();},delay);
}
function sortHand() {
  const p=state.players[0];
  p.hand.sort((a,b)=>{
    if(a.type==="fake")return 1;if(b.type==="fake")return -1;
    return a.color.localeCompare(b.color,"tr")||a.number-b.number;
  });
  renderRack();
}
function renderRack() {
  const rack=$("playerRack");rack.innerHTML="";
  const p=state.players[0];p.hand.forEach(t=>rack.appendChild(tileEl(t,{selectable:true})));
  $("humanCount").textContent=`${p.hand.length} taş`;
  $("selectedInfo").textContent=state.selected.size?`${state.selected.size} taş seçili`:"Seçili taş yok";
  rack.ondragover=e=>e.preventDefault();
  rack.ondrop=e=>{e.preventDefault();const from=Number(e.dataTransfer.getData("text/plain"));const tiles=[...rack.querySelectorAll(".tile")];const target=tiles.find(el=>{const r=el.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right;});if(target)reorderTiles(from,Number(target.dataset.id));};
}
function renderMelds(container, melds) {
  container.innerHTML="";
  if(!melds.length){container.innerHTML='<span class="empty-note">Henüz per yok</span>';return;}
  melds.forEach(m=>container.appendChild(makeMeld(m)));
}
function render() {
  if(!state.players.length)return;
  $("indicatorTile").replaceChildren(tileEl(state.indicator));
  $("okeyTile").replaceChildren(tileEl(state.okey));
  $("deckCount").textContent=`${state.deck.length} taş`;
  $("discardCount").textContent=`${state.discards.length} taş`;
  const last=state.discards[state.discards.length-1],slot=$("discardTile");slot.innerHTML="";
  if(last)slot.appendChild(tileEl(last));else slot.innerHTML="<span>—</span>";
  for(let i=1;i<4;i++){
    const p=state.players[i];
    $(`bot-count-${i}`).textContent=`${p.hand.length} taş`;
    $(`bot-state-${i}`).textContent=state.current===i?(state.busy?"Oynuyor":"Sırası"):(state.opened.has(i)?"Açtı":"Bekliyor");
    $(`bot-card-${i}`).classList.toggle("active",state.current===i);
    renderMelds($(`bot-melds-${i}`),p.melds);
  }
  $("tableMelds").innerHTML="";
  if(!state.tableMelds.length)$("tableMelds").innerHTML='<p class="empty-note">Açılan perler burada görünür.</p>';
  else state.tableMelds.forEach(m=>{
    const wrap=document.createElement("div");wrap.className="table-meld-wrap";
    const label=document.createElement("small");label.textContent=`${state.players[m.playerId].name}${m.pair?" · çift":""}`;
    label.style.cssText="display:block;color:#b8c9be;font-size:9px;margin-bottom:4px";
    wrap.appendChild(label);wrap.appendChild(makeMeld(m.tiles));$("tableMelds").appendChild(wrap);
  });
  renderRack();
  $("dealerInfo").textContent=state.players[state.dealer].name;
  $("turnInfo").textContent=state.players[state.current].name;
  $("remainingInfo").textContent=`${state.deck.length} + ${state.discards.length} atılan`;
  $("turnBadge").textContent=state.gameOver?"Oyun bitti":state.current===0?(state.hasDrawn?"Hamle sende":"Sıra sende"):state.busy?`${state.players[state.current].name} oynuyor`:`${state.players[state.current].name} sırası`;
  $("drawPile").disabled=state.current!==0||state.hasDrawn||state.busy||state.gameOver||!state.deck.length;
  $("takeDiscardBtn").disabled=state.current!==0||state.hasDrawn||state.busy||state.gameOver||!state.discards.length;
  $("openBtn").disabled=state.current!==0||!state.hasDrawn||state.busy||state.gameOver||state.opened.has(0);
  $("processBtn").disabled=state.current!==0||!state.hasDrawn||state.busy||state.gameOver||!state.opened.has(0);
  $("discardBtn").disabled=state.current!==0||!state.hasDrawn||state.busy||state.gameOver;
}
$("drawPile").addEventListener("click",drawFromDeck);
$("takeDiscardBtn").addEventListener("click",takeDiscard);
$("discardBtn").addEventListener("click",discardSelected);
$("openBtn").addEventListener("click",openSelectedMelds);
$("processBtn").addEventListener("click",processSelected);
$("sortBtn").addEventListener("click",sortHand);
$("clearSelectionBtn").addEventListener("click",()=>{state.selected.clear();renderRack();});
$("newGameBtn").addEventListener("click",newGame);

// Expose a small API for later debugging/extensions.
window.Okey101 = {newGame, state, isValidRun, isValidGroup, validMeld, bestMelds, value};
newGame();
})();