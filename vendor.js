/* 업체 화면 (v5.3) — 승인된 협력업체
 *  첫 화면 = 대시보드 (공사 일정 막대 · 이행률 원그래프 · 오늘 할 일)
 *  ☰ 메뉴 = 업무별: 대시보드 / 작업자 등록·오늘 인원 / 작업허가서 발행 / 순회점검 / 비상대피훈련 등록(준비 중) / 계약 서류
 *  공사가 여러 개면 각 메뉴 맨 위에서 공사를 고름 (1개면 자동)
 *  서버: Code.gs myJobs(stats·end) · vendorJob */
let vmenu='dash',vSel='';
const VMENU={dash:'대시보드',workers:'작업자 등록 · 오늘 인원',permit:'작업허가서 발행',insp:'순회점검',meet:'협의체 및 합동점검 참여',drill:'비상대피훈련 등록',docs:'계약 서류'};
const isVendorApproved=()=>!!(state&&!state.staff&&state.company&&state.company.status==='VERIFIED'&&state.company.submissionStatus==='APPROVED');
/** 메뉴 버튼 보이기 (display 때마다) */
function setupVMenu(){const ap=isVendorApproved();document.querySelectorAll('.vmb').forEach(b=>b.classList.toggle('hidden',!ap));
 $('myTab').classList.toggle('hidden',ap);if(!state.staff&&state.company)$('myTab').textContent=ap?'내 업무':'계약 전 서류';if(ap)markVMenu()}
function markVMenu(){document.querySelectorAll('.vmb').forEach(b=>b.classList.toggle('active',b.id==='vm_'+vmenu));if(tab==='my'&&isVendorApproved())$('pageTitle').textContent=VMENU[vmenu]}
/** 메뉴 이동 */
function vgo(m,id){vmenu=m;if(id)vSel=id;toggleMenu(false);stopScan();MEET_TOKEN='';if(tab!=='my')switchTab('my');markVMenu();clearInterval(wkTimer);showQr=false;showAdd=false;window.scrollTo(0,0);
 if(!$('execArea')){renderMy();return}  // 참석 체크 화면 뒤에는 업체 화면을 다시 그림
 if(m==='meet'){renderVMeet();return}
 if(m==='dash'){vjob=null;loadMyJobs();return}if(m==='docs'){renderVDocs();return}if(m==='drill'){renderVDrill();return}vEnsureJob()}
/** 승인 후 화면 시작 (renderMy에서 호출) */
function vStart(){markVMenu();if(vmenu==='meet')return renderVMeet();if(vmenu==='docs')return renderVDocs();if(vmenu==='drill')return renderVDrill();if(vmenu!=='dash'&&vjob)return renderVJob();loadMyJobs()}
async function vEnsureJob(){const el=$('execArea');if(!el)return;
 if(!vjobs){el.innerHTML='<div class="card"><p class="desc">공사를 불러오는 중입니다…</p></div>';try{vjobs=await callQuiet('myJobs')}catch(e){el.innerHTML='<div class="card"><p class="desc">'+escapeText(e.message||'공사를 불러오지 못했습니다.')+'</p></div>';return}}
 const jobs=vjobs.jobs;if(!jobs.length){el.innerHTML='<div class="card"><h2>'+escapeText(VMENU[vmenu])+'</h2><div class="note">아직 배정된 공사가 없습니다.<br>도급인 담당자가 공사에 업체를 배정하면 여기에서 진행할 수 있습니다.</div></div>';return}
 if(!vSel||!jobs.some(j=>j.id===vSel))vSel=(jobs.find(j=>j.status!=='ENDED')||jobs[0]).id;
 if(vjob&&vjob.job.id===vSel){renderVJob();return}await openVJob(vSel)}
function pickJob(id){vSel=id;showQr=false;showAdd=false;openVJob(id)}
/** 업무 화면 머리: 메뉴 이름 + 공사 선택 */
function vJobHead(v){const jobs=(vjobs&&vjobs.jobs)||[];if(!['workers','permit','insp'].includes(vmenu)){vmenu='workers';markVMenu()}
 return '<div class="card vjhead"><h2 style="margin:0">'+escapeText(VMENU[vmenu]||'')+'</h2>'
  +(jobs.length>1?'<label class="muted" for="vjSel" style="display:block;margin-top:10px">공사 선택</label><select id="vjSel" class="vjsel" onchange="pickJob(this.value)">'+jobs.map(j=>'<option value="'+escapeText(j.id)+'" '+(j.id===v.job.id?'selected':'')+'>'+escapeText(j.title)+' ('+escapeText(j.storeName)+')'+(j.status==='ENDED'?' · 종료':'')+'</option>').join('')+'</select>':'')
  +'<div class="muted" style="margin-top:6px">'+(jobs.length>1?'':escapeText(v.job.title)+' · ')+escapeText(v.job.storeName)+' · '+escapeText(v.company.trade)+' · 도급인 '+escapeText(v.job.hostName)+'</div></div>'}
/* ---------- 대시보드 ---------- */
const dayDiff=(a,b)=>Math.round((new Date(b+'T00:00:00Z')-new Date(a+'T00:00:00Z'))/86400000);
function ganttRow(j,t){const s=j.startDate,e=j.endDate||j.startDate,ok=/^\d{4}-\d{2}-\d{2}$/;if(!ok.test(s))return '';
 const total=Math.max(1,dayDiff(s,e)+1),ended=j.status==='ENDED',d=dayDiff(s,t)+1,pct=ended?100:Math.max(0,Math.min(100,Math.round(d/total*100)));
 const left=dayDiff(t,e),lab=ended?'공사 종료':d<1?'착수 '+(1-d)+'일 전':left<0?'종료일 '+(-left)+'일 경과':d+'일째 / 총 '+total+'일 · '+(left?'종료 '+left+'일 전':'오늘 종료');
 const warn=!ended&&(left<0||left<=3&&d>=1);
 return '<div class="gt"><div class="row" style="justify-content:space-between"><b>'+escapeText(j.title)+'</b><span class="muted">'+escapeText(s.slice(5).replace('-','/'))+' ~ '+escapeText(e.slice(5).replace('-','/'))+'</span></div><div class="gbar'+(ended?' end':'')+'" role="img" aria-label="'+escapeText(j.title+' 진행 '+pct+'%')+'"><span style="width:'+pct+'%"></span></div><div class="muted'+(warn?' req':'')+'">'+escapeText(lab)+(ended?'':' · '+pct+'%')+'</div></div>'}
function donut(rate,label,sub){const C=188.5,has=rate!=null,p=has?Math.max(0,Math.min(1,rate)):0,col=!has?'#e5e7eb':p>=0.9?'var(--ok)':p>=0.6?'#111827':'var(--accent)';
 return '<div class="dn"><svg viewBox="0 0 80 80" width="80" height="80" role="img" aria-label="'+escapeText(label+' '+(has?Math.round(p*100)+'%':'기록 없음'))+'"><circle cx="40" cy="40" r="30" fill="none" stroke="#e5e7eb" stroke-width="9"/>'+(has?'<circle cx="40" cy="40" r="30" fill="none" stroke="'+col+'" stroke-width="9" stroke-linecap="round" stroke-dasharray="'+(C*p).toFixed(1)+' '+C+'" transform="rotate(-90 40 40)"/>':'')+'<text x="40" y="45" text-anchor="middle" font-size="15" font-weight="700" fill="#111">'+(has?Math.round(p*100)+'%':'–')+'</text></svg><b>'+escapeText(label)+'</b><span class="muted">'+escapeText(sub)+'</span></div>'}
function todoRows(j,t){const S=j.stats||{},inRange=j.startDate<=t&&(!j.endDate||t<=j.endDate),id=escapeText(j.id),list=[];
 if(inRange&&!j.todayDone)list.push(['workers','오늘 작업 인원 · 안전 수칙 서명','미체크']);
 if(inRange&&!S.todayPermit)list.push(['permit','오늘 작업허가서','미발행']);
 if(S.inspDue&&!S.inspToday&&j.startDate<=t)list.push(['insp','순회점검',S.lastInsp?dayDiff(S.lastInsp,t)+'일 경과':'점검 기록 없음']);
 if(S.openFindings)list.push(['insp','미조치 지적사항',S.openFindings+'건']);
 if(!list.length)return '<div class="note" style="margin-top:12px">✔ 오늘 할 일을 모두 마쳤습니다.</div>';
 return '<div class="stage">오늘 할 일</div>'+list.map(([m,txt,tag])=>'<button class="vtodo" type="button" onclick="vgo(\''+m+'\',\''+id+'\')"><span>'+escapeText(txt)+'</span><span class="req">'+escapeText(tag)+' ›</span></button>').join('')}
function renderDash(){const el=$('execArea');if(!el||!vjobs)return;clearTimeout(window.__pf);window.__pf=setTimeout(()=>vjobs.jobs.filter(j=>j.status!=='ENDED').slice(0,3).forEach((j,i)=>setTimeout(()=>callQuiet('vendorJob',j.id).catch(()=>{}),i*400)),800);vjob=null;clearInterval(wkTimer);const d=vjobs,t=d.today,act=d.jobs.filter(j=>j.status!=='ENDED'),ended=d.jobs.filter(j=>j.status==='ENDED');
 const due=act.reduce((n,j)=>n+((j.stats&&j.stats.inspDue&&!j.stats.inspToday&&j.startDate<=t)?1:0)+((j.stats&&j.stats.openFindings)||0),0);setBadge($('vm_insp'),due);setBadge($('menuBtn'),due);
 el.innerHTML='<div class="card"><h2 style="margin:0">'+escapeText(d.company)+'</h2><div class="muted">'+escapeText(t)+' · 진행 중 공사 '+act.length+'건'+(ended.length?' · 종료 '+ended.length+'건':'')+'</div></div>'
  +(d.jobs.length?'<div class="card"><h2>공사 일정</h2>'+act.concat(ended).map(j=>ganttRow(j,t)).join('')+'</div>'
  +act.map(j=>{const S=j.stats||{},wd=S.workDays||0;return '<div class="card"><div class="vh-top"><div><h2 style="margin:0">'+escapeText(j.title)+'</h2><div class="muted">'+escapeText(j.storeName)+' · 도급인 '+escapeText(j.hostName)+' · 작업자 '+j.workers+'명</div></div></div>'
   +'<div class="dns">'+donut(S.inspNeed?S.insp/S.inspNeed:null,'순회점검',S.inspNeed?S.insp+' / '+S.inspNeed+'회':'기록 없음')+donut(wd?S.permitDays/wd:null,'작업허가서',wd?S.permitDays+' / '+wd+'일':'기록 없음')+donut(wd?S.crewDays/wd:null,'인원·수칙',wd?S.crewDays+' / '+wd+'일':'기록 없음')+'</div>'
   +'<p class="muted" style="text-align:center;margin:4px 0 0">작업일 '+wd+'일 기준 이행률</p>'+todoRows(j,t)+'</div>'}).join('')
  +(ended.length?'<div class="card"><h2>종료된 공사</h2>'+ended.map(j=>'<button class="jobitem" type="button" onclick="vgo(\'workers\',\''+escapeText(j.id)+'\')"><div><b>'+escapeText(j.title)+'</b> <span class="pill todo">종료</span><div class="muted">'+escapeText(j.storeName)+' · '+escapeText(j.startDate)+' ~ '+escapeText(j.endDate||'')+'</div></div><span aria-hidden="true">›</span></button>').join('')+'</div>':'')
  :'<div class="card"><div class="note">아직 배정된 공사가 없습니다.<br>도급인 담당자가 공사에 업체를 배정하면 여기에 나타납니다.</div></div>')}
/* ---------- 비상대피훈련 · 계약 서류 ---------- */
function renderVDrill(){const el=$('execArea');if(el)el.innerHTML='<div class="card"><div class="vh-top"><h2 style="margin:0">비상대피훈련 등록</h2><span class="pill todo">준비 중</span></div><p class="desc">공사마다 1회 훈련을 실시하고 결과를 등록하는 화면입니다.</p><div class="note">등록 화면은 준비 중입니다. 열리면 이 메뉴에서 바로 등록할 수 있습니다.</div></div>'}
function renderVDocs(){const el=$('execArea');if(!el)return;const rows=((state.docBoard&&state.docBoard.rows)||[]).filter(r=>r.stage==='CONTRACT'&&r.vendorDoc);
 el.innerHTML='<div class="card"><div class="vh-top"><h2 style="margin:0">계약 서류</h2><span class="pill ok">계약 전 검토 승인</span></div><p class="desc">계약 전에 제출한 서류입니다. 눌러서 내려받을 수 있습니다.</p>'
  +(rows.map(r=>{const u=r.uploads[0];return '<div class="item"><b>'+escapeText(r.name)+'</b><div class="muted">'+(u?'<a onclick="viewFile(\''+escapeText(u.id)+'\')">📄 '+escapeText(u.name)+'</a> · '+escapeText(fmtTime(u.uploadedAt)):'제출 기록 없음')+'</div></div>'}).join('')||'<p class="muted">제출한 서류가 없습니다.</p>')+'</div>'}
