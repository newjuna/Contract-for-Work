/* 안전작업허가서 (v4.7) — 현업 양식 「안전작업허가서 (매일1회 / 8시간 기준, 연장작업시 추가1회)」 항목 그대로
 *  업체: [오늘 할 일] ③ 작업허가서 → 작성 → [발행] (바로 작업) → 진행 기록(가스측정·작업중 확인·완료·연장)
 *  도급인: [공사·현장미팅] → 공사의 [작업허가서] → 보기 → [승인]
 *  서버 기능은 Code.gs (getPermit·issuePermit·updatePermitProgress·permitList·permitDetail·approvePermit) */
const PERMIT_ATTACH=[['plan','작업계획서'],['tech','기술자료(도면)'],['ext','소화기목록'],['gear','안전장구 목록'],['special','특수작업절차서'],['dig','굴착도면']];
const PERMIT_SAFETY=[['zone','작업구역 설정(출입경고 표지)'],['flam','작업주위 가연성물질 제거'],['gasm','가스농도 측정'],['valve','밸브차단 및 차단표지부착(도면 비교)'],['blind','맹판설치 및 표지부착(도면 비교)'],['hazard','위험물질(가연성분진 포함)방출 및 처리'],
 ['open','용기개방 및 압력방출'],['clean','용기내부 세정 및 처리'],['inert','불활성가스 치환 및 환기'],['spark','비산불티차단막 설치'],['vent','환기장비'],
 ['light','조명장비'],['fire','소화기'],['gear','안전장구'],['edu','안전교육'],['operator','운전요원의 입회']];
const PERMIT_SUPP=[
 ['high','고소',{checks:[['platform','작업발판, 안전난간'],['harness','안전대 착용·부착'],['net','추락방지망']]}],
 ['power','정전',{texts:[['ctrlRoom','차단기기 : 제어실'],['ctrlSite','차단기기 : 현장']],checks:[['c1','제어실 : 스위치, 차단기 내림'],['c2','제어실 : 잠금장치 시건, 표지부착'],['s1','현장 : 스위치, 차단기 내림'],['s2','현장 : 잠금장치 시건, 표지부착']],
   after:[['restoreBy','※ 전원복구 : 요청자'],['restoreAt','복구시간'],['restoreChecker','전원복구 확인자']],note:'전원복구 : 모든 작업이 완료된 후 운전부서의 입회자의 요청에 의해서만 전원을 복구하여야 한다.'}],
 ['heavy','중장비',{texts:[['equip','투입장비']],checks:[['license','자격증 소지'],['supervise','현장책임자 감독'],['ground','기상, 노면상태'],['wire','전선, 설비 간섭'],['signal','신호수배치'],['mat','매트 등 부속장구']],after:[['operatorName','운전원']]}],
 ['dig','굴착',{checks:[['gasPipe','설비 : 가스,기계,소방배관'],['elecLine','설비 : 전기,계장,통신']],after:[['gasBy','점검자 (가스·기계·소방배관)'],['elecBy','점검자 (전기·계장·통신)']]}],
 ['confined','밀폐공간',{checks:[['comm','통신수단'],['rescue','구명장구(줄, 송기마스크)']],note:'가스농도 측정결과 1. CO: 30ppm미만, 2. H2S: 10ppm미만, 3. LEL: %미만, 4. O2: 18%이상'}],
 ['radiation','방사선',{checks:[['access','비인가자 출입제한'],['warn','방사선 위험경고, 표지'],['license','자격증 소지'],['map','방사선 방사점 도면 첨부']]}]];
const GAS_KEYS=[['co','CO(일산화탄소)'],['h2s','H2S(황화수소)'],['lel','LEL(폭발하한계)'],['o2','O2(산소)']];
const P_STATUS={NEW:['작성 전','todo'],ISSUED:['발행됨 · 승인 대기','todo'],APPROVED:['✔ 승인','ok']};
let pm=null;  // 지금 보고 있는 허가서 {mode:'new'|'progress'|'view'|'staff', permit, ...}
const pv=(o,k,d='')=>o&&o[k]!==undefined&&o[k]!==null?o[k]:d;
/* ---------- 업체: [오늘 할 일] ③ 카드 ---------- */
function permitCardHtml(v){const list=v.permits||[],t=list.find(p=>p.date===v.today),past=list.filter(p=>p.date!==v.today),st=t?P_STATUS[t.status]||[t.status,'todo']:null;
 return '<div class="card" id="permitCard"><div class="vh-top"><h2 style="margin:0">③ 작업허가서</h2>'+(t?'<span class="pill '+st[1]+'">'+escapeText(st[0])+'</span>':'<span class="pill todo">매일 1회 · 미발행</span>')+'</div>'
  +(t?'<p class="desc">허가번호 '+escapeText(t.no)+' · '+escapeText(t.workName)+' · '+escapeText(t.start)+'~'+escapeText(t.end)+(t.completed?' · <b style="color:var(--ok)">작업완료 기록</b>':'')+'<br>발행했으므로 작업을 진행하세요. 도급인 담당자가 나중에 승인합니다. 가스농도 측정·작업중 확인·작업완료는 아래 버튼에서 기록합니다.</p><button class="button" type="button" style="width:100%" onclick="openPermit(\''+escapeText(v.today)+'\')">허가서 보기 · 진행 기록</button>'
   :'<p class="desc">작업 전에 작성하고 <b>[발행]</b>하면 바로 작업할 수 있습니다. 지난 허가서가 있으면 내용이 미리 채워집니다.</p><button class="button" type="button" style="width:100%" onclick="openPermit(\''+escapeText(v.today)+'\')">오늘 작업허가서 작성</button>')
  +(past.length?'<details class="hist" style="margin-top:12px"><summary>지난 허가서 '+past.length+'건</summary>'+past.map(p=>'<div class="item"><div class="row" style="justify-content:space-between"><span>'+escapeText(p.date)+' · '+escapeText(p.workName)+' <span class="pill '+(P_STATUS[p.status]||['','todo'])[1]+'">'+escapeText((P_STATUS[p.status]||[p.status])[0])+'</span></span><button class="button ghost" type="button" onclick="openPermit(\''+escapeText(p.date)+'\')">보기</button></div></div>').join('')+'</details>':'')+'</div>'}
async function openPermit(date){try{const r=await call('getPermit',vjob.job.id,date);pm={mode:r.exists?(r.permit.date===r.today?'progress':'view'):'new',permit:r.permit,fromLast:r.fromLast,today:r.today};clearInterval(wkTimer);$('execArea').innerHTML=permitPage();window.scrollTo(0,0)}catch(e){}}
function closePermit(){pm=null;renderVJob();$('permitCard')?.scrollIntoView({block:'start'})}
/* ---------- 허가서 화면 (업체 작성·진행 / 직원 보기·승인 공용) ---------- */
function chip(id,label,on,dis){return '<label class="pchip"><input type="checkbox" id="'+id+'" '+(on?'checked':'')+' '+(dis?'disabled':'')+'><span>'+label+'</span></label>'}
function pin(id,label,val,dis,type,ph){return '<div class="field"><label for="'+id+'">'+label+'</label><input id="'+id+'" type="'+(type||'text')+'" value="'+escapeText(val||'')+'" '+(dis?'disabled':'')+(ph?' placeholder="'+escapeText(ph)+'"':'')+'></div>'}
function permitPage(){const P=pm.permit,d=P.data||{},M=pm.mode,lock=M!=='new',plock=!(M==='new'||M==='progress'),st=P_STATUS[P.status]||[P.status,'todo'];
 const back=M==='staff'?'<button class="button ghost" type="button" onclick="backPermitList()">← 허가서 목록</button>':'<button class="button ghost" type="button" onclick="closePermit()">← 오늘 할 일</button>';
 const S=[];let h='<div class="card">'+back+'<div class="vh-top" style="margin-top:12px"><div><h2 class="sheet-t" style="text-align:left;margin:0">안 전 작 업 허 가 서</h2><div class="muted">(매일1회 / 8시간 기준, 연장작업시 추가1회)</div></div><span class="pill '+st[1]+'">'+escapeText(st[0])+'</span></div>'
  +(M==='new'&&pm.fromLast?'<div class="note" style="margin-top:10px">'+escapeText(pm.fromLast)+' 허가서 내용을 미리 채웠습니다. 오늘 작업에 맞게 고치고, <b>조치 완료</b>·<b>확인자</b>는 오늘 다시 체크해 주세요.</div>':'')
  +'%%TABS%%</div><div class="card">'+'<table class="rtable"><tr><th>허가번호</th><td>'+escapeText(P.no||'(발행 시 자동)')+'</td></tr><tr><th>허가일자</th><td>'+escapeText(P.date)+'</td></tr><tr><th>업체명</th><td>'+escapeText(P.company||'')+'</td></tr></table>'
  +'<div class="stage">신청인</div><div class="split3">'+pin('p_apDept','부서',pv(d.applicant,'dept'),lock)+pin('p_apTitle','직책',pv(d.applicant,'title'),lock)+pin('p_apName','성명 *',pv(d.applicant,'name'),lock)+'</div>'
  +'<div class="stage">작업허가기간 · '+escapeText(P.date)+'</div><div class="split">'+pin('p_start','시작 시각 *',pv(d.period,'start'),lock,'time')+pin('p_end','종료 시각 *',pv(d.period,'end'),lock,'time')+'</div>'
  +'<div class="stage">작업장소 및 설비(기기)</div><div class="split">'+pin('p_place','작업지역(장소) *',d.place,lock)+pin('p_device','장치명',d.device,lock)+'</div>'+pin('p_work','작업명(공정) *',d.workName,lock,'text','예: 철거, 목공')
  +'<div class="stage">첨부서류</div><div class="pchips">'+PERMIT_ATTACH.map(([k,l])=>chip('pa_'+k,l,pv(d.attach,k,false),lock)).join('')+'</div>'
  +'<div class="stage">작업 전 위험성평가 필요</div>'+[['procChange','작업절차서 변화'],['workDiff','작업상이']].map(([k,l])=>'<div class="row" style="margin:6px 0"><span style="min-width:130px">'+l+'</span>'+['유','무'].map(x=>'<label class="pchip"><input type="radio" name="pp_'+k+'" value="'+x+'" '+(pv(d.pre,k,'무')===x?'checked':'')+' '+(lock?'disabled':'')+'><span>'+x+'</span></label>').join('')+'</div>').join('')+'</div>';
 // 탭 1: 첫 카드(제목·탭)와 기본정보 분리
 const cut=h.indexOf('</div><div class="card">'+'<table class="rtable">');const head=h.slice(0,cut+6);S.push(['basic','기본정보',h.slice(cut+6)]);h='';
 // 안전조치 요구사항
 h+='<div class="card"><h2>안전조치 요구사항</h2><p class="desc">필요한 사항에 <b>필요</b> 표시, 조치 시행 후 <b>조치 완료</b> 표시. 필요 항목은 조치 완료해야 발행할 수 있습니다.</p>'
  +PERMIT_SAFETY.map(([k,l])=>{const x=pv(d.safety,k,{});return '<div class="prow" id="ps_'+k+'"><span>'+escapeText(l)+'</span><span class="pchips">'+chip('psn_'+k,'필요',x.need,lock)+chip('psd_'+k,'조치 완료',x.done,lock)+'</span></div>'}).join('')+'</div>';
 S.push(['safety','안전조치',h]);h='';
 // 보충작업허가
 h+='<div class="card"><h2>보충작업허가</h2><p class="desc">해당하는 작업만 켜면 세부 항목이 열립니다.</p>'+PERMIT_SUPP.map(([k,l,s])=>{const x=pv(d.supp,k,{}),on=!!x.on;
  return '<div class="psupp'+(on?' on':'')+'" id="pu_'+k+'"><label class="psw"><input type="checkbox" id="puo_'+k+'" '+(on?'checked':'')+' '+(lock?'disabled':'')+' onchange="toggleSupp(\''+k+'\')"><span><b>'+l+'</b> 작업</span></label><div class="psub" '+(on?'':'hidden')+'>'
   +(s.texts||[]).map(([t,tl])=>pin('put_'+k+'_'+t,tl,x[t],lock)).join('')
   +(s.checks||[]).map(([c,cl])=>{const y=pv(x.checks,c,{});return '<div class="prow" id="puc_'+k+'_'+c+'"><span>'+escapeText(cl)+'</span><span class="pchips">'+chip('pucn_'+k+'_'+c,'필요',y.need,lock)+chip('pucd_'+k+'_'+c,'조치 완료',y.done,lock)+'</span></div>'}).join('')
   +(s.note?'<p class="muted" style="margin:6px 0">'+escapeText(s.note)+'</p>':'')
   +'<div class="split3">'+pin('puf_'+k,'허가기간 시작 *',x.from,lock,'time')+pin('pue_'+k,'허가기간 종료 *',x.to,lock,'time')+pin('puk_'+k,'확인자 (서명) *',x.checker,lock)+'</div>'
   +(s.after||[]).map(([t,tl])=>pin('put_'+k+'_'+t,tl,x[t],plock)).join('')+'</div></div>'}).join('')+'</div>';
 S.push(['supp','보충작업',h]);h='';
 // 안전조치 확인 · 기타 · 발급자
 h+='<div class="card"><h2>안전조치 확인</h2><div class="split">'+pin('p_cfMgr','작업 부서 책임자 (서명) *',pv(d.confirm,'manager'),lock)+pin('p_cfWit','입회자 (서명)',pv(d.confirm,'witness'),lock)+'</div>'
  +'<div class="field"><label for="p_etc">기타 특별사항</label><textarea id="p_etc" '+(lock?'disabled':'')+' style="min-height:60px">'+escapeText(d.etc||'')+'</textarea></div>'
  +'<div class="stage">발급자</div><div class="split3">'+pin('p_isDept','부서',pv(d.issuer,'dept'),lock)+pin('p_isTitle','직책',pv(d.issuer,'title'),lock)+pin('p_isName','성명 (인) *',pv(d.issuer,'name'),lock)+'</div>'
  +'<div class="stage">승인자</div>'+(P.status==='APPROVED'?'<div class="note"><b style="color:var(--ok)">✔ 승인</b> · '+escapeText(P.approvedBy)+' · '+escapeText(fmtTime(P.approvedAt))+(P.approveNote?'<br>의견: '+escapeText(P.approveNote):'')+'</div>':'<p class="muted">도급인 담당자가 발행 후 확인하고 승인합니다.</p>')+'</div>';
 S.push(['sign','확인·발급',h]);h='';
 // 진행 기록 (발행 후)
 if(M!=='new'){const gas=d.gas||[],dur=d.during||[],cp=d.complete||{},ex=d.extend||{};
  h+='<div class="card"><h2>가스농도 측정 <span class="muted">(MSDS 참조)</span></h2><p class="desc">측정할 때마다 한 줄씩 기록합니다 (최대 5회). 가스별 상이 (LPG: 2.2mol% 미만)</p>'
   +[0,1,2,3,4].map(i=>{const g=gas[i]||{};return '<div class="pgas"><b>'+(i+1)+'회</b>'+pin('pg_t'+i,'측정시간',g.time,plock,'time')+GAS_KEYS.map(([k,l])=>pin('pg_'+k+i,l,g[k],plock)).join('')+pin('pg_by'+i,'측정(확인)자',g.by,plock)+'</div>'}).join('')
   +'<div class="field"><label for="p_gasNote">비고</label><input id="p_gasNote" value="'+escapeText(d.gasNote||'')+'" '+(plock?'disabled':'')+'></div></div>'
   +'<div class="card"><h2>작업중 확인</h2>'+[0,1,2,3,4].map(i=>{const x=dur[i]||{};return '<div class="split">'+pin('pd_t'+i,(i+1)+'회 시간',x.time,plock,'time')+pin('pd_by'+i,'확인자',x.by,plock)+'</div>'}).join('')+'</div>'
   +'<div class="card"><h2>작업완료</h2><div class="split">'+pin('pc_time','완료 시간',cp.time,plock,'time')+pin('pc_wit','입회자 (인)',cp.witness,plock)+pin('pc_site','현장담당자 (인)',cp.site,plock)+pin('pc_rest','복원(조치)상태',cp.restore,plock)+'</div></div>'
   +'<div class="card"><h2>작업허가 연장</h2><div class="split">'+pin('pe_date','연장일',ex.date,plock,'date')+pin('pe_from','시작',ex.from,plock,'time')+pin('pe_to','종료',ex.to,plock,'time')+pin('pe_by','발급자 (인)',ex.by,plock)+'</div></div>'}
 if(h)S.push(['prog','진행 기록',h]);h='';
 // 탭: 발행 후에는 '진행 기록'부터, 작성·승인 화면은 '기본정보'부터
 if(!pm.tab||!S.some(s=>s[0]===pm.tab))pm.tab=M==='progress'?'prog':'basic';
 const tabs='<div class="seg ptabs" role="tablist">'+S.map(([k,l])=>'<button type="button" role="tab" id="pt_'+k+'" aria-selected="'+(pm.tab===k)+'" class="'+(pm.tab===k?'on':'')+'" onclick="setPermitTab(\''+k+'\')">'+l+'</button>').join('')+'</div>';
 h=head.replace('%%TABS%%',tabs)+S.map(([k,,x])=>'<div id="pp_'+k+'" '+(pm.tab===k?'':'hidden')+'>'+x+'</div>').join('')
  +(pm.mode==='new'?'<div class="row pnav" style="justify-content:space-between;margin:0 0 14px">'+(()=>{const i=S.findIndex(s=>s[0]===pm.tab);return (i>0?'<button class="button ghost" type="button" onclick="setPermitTab(\''+S[i-1][0]+'\')">← '+S[i-1][1]+'</button>':'<span></span>')+(i<S.length-1?'<button class="button ghost" type="button" onclick="setPermitTab(\''+S[i+1][0]+'\')">'+S[i+1][1]+' →</button>':'')})()+'</div>':'');
 // 아래 버튼
 h+='<div class="card roomfoot">'+(M==='new'?'<button class="button" type="button" style="width:100%" onclick="issuePermitNow()">발행 (바로 작업 시작)</button>'
  :M==='progress'?'<button class="button" type="button" style="width:100%" onclick="savePermitProgress()">진행 기록 저장</button>'
  :M==='staff'?(P.status==='APPROVED'?'<p class="desc" style="margin:0">승인 완료된 허가서입니다.</p>':'<div class="field" style="margin-top:0"><label for="p_apNote">승인 의견 (선택)</label><input id="p_apNote" placeholder="예: 고소작업 안전대 체결 확인"></div><button class="button" type="button" style="width:100%" onclick="approvePermitNow()">승인 ('+escapeText(pm.approver?pm.approver.name:'')+')</button>')
  :'<p class="desc" style="margin:0">지난 허가서는 보기만 할 수 있습니다.</p>')+'</div>';
 return h}
/** 탭 전환: 입력한 값은 그대로 두고 보이는 구역만 바꿈 (이전/다음 버튼도 다시 그림) */
function setPermitTab(k){if(!pm)return;pm.tab=k;document.querySelectorAll('[id^=pp_]').forEach(p=>{if(/^pp_(basic|safety|supp|sign|prog)$/.test(p.id))p.hidden=p.id!=='pp_'+k});
 document.querySelectorAll('.ptabs button').forEach(b=>{const on=b.id==='pt_'+k;b.classList.toggle('on',on);b.setAttribute('aria-selected',String(on))});
 if(pm.mode==='new'){const order=[...document.querySelectorAll('.ptabs button')].map(b=>[b.id.slice(3),b.textContent]),i=order.findIndex(o=>o[0]===k),nav=document.querySelector('.ptabs').closest('.card').parentNode.querySelector('.pnav');if(nav)nav.innerHTML=(i>0?'<button class="button ghost" type="button" onclick="setPermitTab(\''+order[i-1][0]+'\')">← '+order[i-1][1]+'</button>':'<span></span>')+(i<order.length-1?'<button class="button ghost" type="button" onclick="setPermitTab(\''+order[i+1][0]+'\')">'+order[i+1][1]+' →</button>':'')}
 window.scrollTo(0,0)}
function toggleSupp(k){const on=$('puo_'+k).checked,b=$('pu_'+k);b.classList.toggle('on',on);b.querySelector('.psub').hidden=!on}
const ck=id=>!!($(id)&&$(id).checked),tv=id=>($(id)?$(id).value.trim():'');
/** 화면 → 허가서 내용 */
function permitCollect(){const d={applicant:{dept:tv('p_apDept'),title:tv('p_apTitle'),name:tv('p_apName')},period:{start:tv('p_start'),end:tv('p_end')},place:tv('p_place'),device:tv('p_device'),workName:tv('p_work'),
  attach:Object.fromEntries(PERMIT_ATTACH.map(([k])=>[k,ck('pa_'+k)])),pre:{procChange:document.querySelector('input[name=pp_procChange]:checked')?.value||'무',workDiff:document.querySelector('input[name=pp_workDiff]:checked')?.value||'무'},
  safety:Object.fromEntries(PERMIT_SAFETY.map(([k])=>[k,{need:ck('psn_'+k),done:ck('psd_'+k)}])),supp:{},
  confirm:{manager:tv('p_cfMgr'),witness:tv('p_cfWit')},etc:tv('p_etc'),issuer:{dept:tv('p_isDept'),title:tv('p_isTitle'),name:tv('p_isName')}};
 PERMIT_SUPP.forEach(([k,,s])=>{const x={on:ck('puo_'+k),from:tv('puf_'+k),to:tv('pue_'+k),checker:tv('puk_'+k),checks:{}};(s.texts||[]).concat(s.after||[]).forEach(([t])=>x[t]=tv('put_'+k+'_'+t));(s.checks||[]).forEach(([c])=>x.checks[c]={need:ck('pucn_'+k+'_'+c),done:ck('pucd_'+k+'_'+c)});d.supp[k]=x});
 return d}
function progressCollect(){const supp={};PERMIT_SUPP.forEach(([k,,s])=>(s.after||[]).forEach(([t])=>{if($('put_'+k+'_'+t)){supp[k]=supp[k]||{};supp[k][t]=tv('put_'+k+'_'+t)}}));
 return {gas:[0,1,2,3,4].map(i=>({time:tv('pg_t'+i),co:tv('pg_co'+i),h2s:tv('pg_h2s'+i),lel:tv('pg_lel'+i),o2:tv('pg_o2'+i),by:tv('pg_by'+i)})).filter(g=>Object.values(g).some(Boolean)),gasNote:tv('p_gasNote'),
  during:[0,1,2,3,4].map(i=>({time:tv('pd_t'+i),by:tv('pd_by'+i)})).filter(x=>x.time||x.by),complete:{time:tv('pc_time'),witness:tv('pc_wit'),site:tv('pc_site'),restore:tv('pc_rest')},extend:{date:tv('pe_date'),from:tv('pe_from'),to:tv('pe_to'),by:tv('pe_by')}}}
/** 발행 전 확인: 빠진 칸 → 자동 이동 + 붉은 테두리·흔들림 */
function permitMissing(d){const m=[];if(!d.applicant.name)m.push('p_apName');if(!d.period.start)m.push('p_start');if(!d.period.end)m.push('p_end');if(!d.place)m.push('p_place');if(!d.workName)m.push('p_work');
 PERMIT_SAFETY.forEach(([k])=>{if(d.safety[k].need&&!d.safety[k].done)m.push('ps_'+k)});
 PERMIT_SUPP.forEach(([k,,s])=>{const x=d.supp[k];if(!x.on)return;if(!x.from)m.push('puf_'+k);if(!x.to)m.push('pue_'+k);if(!x.checker)m.push('puk_'+k);(s.checks||[]).forEach(([c])=>{if(x.checks[c].need&&!x.checks[c].done)m.push('puc_'+k+'_'+c)})});
 if(!d.confirm.manager)m.push('p_cfMgr');if(!d.issuer.name)m.push('p_isName');return m}
function flagMissing(ids,text){const f0=$(ids[0]),pane=f0&&f0.closest('[id^=pp_]');if(pane)setPermitTab(pane.id.slice(3));document.querySelectorAll('.miss').forEach(x=>x.classList.remove('miss','shake'));ids.forEach(id=>{const el=$(id);if(!el)return;el.classList.add('miss');void el.offsetWidth;el.classList.add('shake');if(el.tagName==='INPUT')el.addEventListener('input',()=>el.classList.remove('miss','shake'),{once:true})});const f=$(ids[0]);if(f){f.scrollIntoView({behavior:'smooth',block:'center'});if(f.tagName==='INPUT')setTimeout(()=>f.focus({preventScroll:true}),400)}msg(text)}
async function issuePermitNow(){const d=permitCollect(),m=permitMissing(d);if(m.length){flagMissing(m,'확인할 칸 '+m.length+'개 · 빨간 칸을 확인해 주세요 (필요 항목은 조치 완료 체크)');return}
 if(!confirm('오늘 작업허가서를 발행할까요?\n발행하면 바로 작업할 수 있고, 도급인 담당자에게 승인 요청이 갑니다.\n(발행 후에는 진행 기록만 고칠 수 있습니다)'))return;
 try{const r=await call('issuePermit',vjob.job.id,d);pm={mode:'progress',permit:r.permit,today:r.today};vjob.permits=[{...r.permit}].concat((vjob.permits||[]).filter(p=>p.date!==r.permit.date));$('execArea').innerHTML=permitPage();window.scrollTo(0,0);msg('발행했습니다. 작업을 시작하세요.')}catch(e){alert(e.message)}}
async function savePermitProgress(){try{const r=await call('updatePermitProgress',pm.permit.id,progressCollect());pm.permit=r.permit;$('execArea').innerHTML=permitPage();msg('진행 기록을 저장했습니다.');vjob.permits=(vjob.permits||[]).map(p=>p.id===r.permit.id?{...p,completed:r.permit.completed}:p)}catch(e){}}
/* ---------- 직원: 공사별 허가서 목록 · 보기 · 승인 ---------- */
let permitJob=null;
async function openPermitList(jobId){try{permitJob=await call('permitList',jobId);jobsMode='permits';renderPermitList();window.scrollTo(0,0)}catch(e){}}
function renderPermitList(){const d=permitJob,w=d.list.filter(p=>p.status==='ISSUED').length;
 $('jobs').innerHTML='<div class="card"><button class="button ghost" type="button" onclick="loadJobs()">← 공사 목록</button><h2 style="margin-top:12px">작업허가서 · '+escapeText(d.job.title)+'</h2><p class="desc">업체가 발행한 허가서입니다. 발행 즉시 작업이 시작되며, 확인 후 승인해 주세요.'+(w?' <b class="req">승인 대기 '+w+'건</b>':'')+'</p></div>'
  +'<div class="card">'+(d.list.map(p=>'<button class="jobitem" type="button" onclick="openPermitStaff(\''+escapeText(p.id)+'\')"><div><b>'+escapeText(p.date)+' · '+escapeText(p.company)+'</b> <span class="pill '+(P_STATUS[p.status]||['','todo'])[1]+'">'+escapeText((P_STATUS[p.status]||[p.status])[0])+'</span><div class="muted">'+escapeText(p.no)+' · '+escapeText(p.workName)+' · '+escapeText(p.start)+'~'+escapeText(p.end)+(p.completed?' · 작업완료':'')+'</div></div><span aria-hidden="true">›</span></button>').join('')||'<p class="muted">아직 발행된 허가서가 없습니다.</p>')+'</div>'}
async function openPermitStaff(id){try{const r=await call('permitDetail',id);pm={mode:'staff',permit:r,approver:r.approver};jobsMode='permit';$('jobs').innerHTML=permitPage();window.scrollTo(0,0)}catch(e){}}
async function backPermitList(){if(permitJob)await openPermitList(permitJob.job.id);else loadJobs()}
async function approvePermitNow(){if(!confirm('이 작업허가서를 승인할까요?'))return;try{const r=await call('approvePermit',pm.permit.id,tv('p_apNote'));pm.permit=r;$('jobs').innerHTML=permitPage();window.scrollTo(0,0);msg('승인했습니다.');refreshBadges();const j=jobData&&jobData.jobs.find(x=>x.id===r.jobId);if(j)j.permitWaiting=Math.max(0,(j.permitWaiting||1)-1)}catch(e){}}
