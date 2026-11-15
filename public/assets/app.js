import {Terrain} from './terrain.js';
import {MarsView} from './mars-view.js';
import {Map2D} from './map2d.js';
import {R,wrap,clamp,parsePoint,coordinate,interpolate,distance} from './geo.js';
import {translations} from './i18n.js';
const $=id=>document.getElementById(id);
Object.assign(translations.en,{sound:'Sound'});Object.assign(translations.tr,{sound:'Ses'});
const backgroundAudio=new Audio('assets/backgroundloop.wav'),routeAudio=new Audio('assets/Sfx1.wav');
backgroundAudio.loop=true;backgroundAudio.volume=.35;routeAudio.volume=.7;
let soundEnabled=true;try{soundEnabled=localStorage.getItem('mars-sound')!=='off';}catch{}
$('sound-enabled').checked=soundEnabled;
function startBackground(){if(soundEnabled&&backgroundAudio.paused)backgroundAudio.play().catch(()=>{});}
document.addEventListener('pointerdown',startBackground);document.addEventListener('keydown',startBackground);
$('sound-enabled').addEventListener('change',e=>{soundEnabled=e.target.checked;try{localStorage.setItem('mars-sound',soundEnabled?'on':'off');}catch{}if(soundEnabled)startBackground();else{backgroundAudio.pause();routeAudio.pause();}});
function playRouteSound(){if(!soundEnabled)return;routeAudio.currentTime=0;routeAudio.play().catch(()=>{});}
startBackground();
Object.assign(translations.en,{thermalDay:'Thermal inertia (day)'});Object.assign(translations.tr,{thermalDay:'Isıl atalet (gündüz)'});
Object.assign(translations.en,{routeTitle:'Make a route',start:'Starting point',routeMode:'Assessment',terrainCandidate:'Terrain candidate · hazards unassessed',allHazards:'Require all safety layers',calculate:'Calculate route',clear:'Clear',routeRules:'Slope limit 0.8 with local relief above 50 m. Terrain is evaluated at its native resolution; smaller obstacles are unresolved.',fitRoute:'Show entire route ↗',oneLayer:'One layer at a time. No blended datasets.',candidate:'Terrain route generated. Chemical safety, radiation and temperature remain unassessed.',allMissing:'Full safety routing is unavailable: calibrated chemical, radiation and temperature coverage is missing.',pickStart:'Choose the starting point on either map.',pickEnd:'Choose the destination on either map.',ready:'NASA terrain ready',calculating:'Finding a terrain route…',badStart:'Enter a valid starting landmark or latitude, longitude.',badEnd:'Enter a valid destination landmark or latitude, longitude.',native:'Native terrain sampling',distance:'Distance',ascent:'Sampled ascent',maxSlope:'Max sampled slope',slopeLimit:'Max slope limit',eta:'Estimated arrival',avgSpeed:'Mean speed',gridStep:'Route search spacing',noData:'No data',layerLoading:'Loading map layer…',surface:'Viking color imagery',relief:'NASA MOLA topography',ctx:'CTX imagery',water:'Water-equivalent hydrogen',chlorine:'Chlorine abundance',thermal:'Thermal inertia (night)',radiation:'Radiation exposure',temperature:'Surface temperature',cargoTitle:'Cargo & vehicle',vehicleType:'Vehicle type',vehicleFeet:'On foot (EVA suit)',vehicleRover:'Robotic Rover (Perseverance)',vehicleCrewRover:'Crewed Rover (LRV)',vehicleTruck:'Heavy Cargo Truck (SEV)',cargoWeight:'Cargo mass (kg)',cargoNote:'Slope limit and cruise speed adjust automatically to vehicle type and payload mass.',cruiseSpeed:'Nominal speed',reliefThreshold:'Relief threshold',missionStart:'Supply Mission',missionPrev:'← Back',missionNext:'Next →',missionDone:'Finish Mission'});
Object.assign(translations.tr,{routeTitle:'Rota oluştur',start:'Başlangıç noktası',routeMode:'Değerlendirme',terrainCandidate:'Arazi rotası · tehlikeler değerlendirilmedi',allHazards:'Tüm güvenlik katmanlarını gerektir',calculate:'Rotayı hesapla',clear:'Temizle',routeRules:'Eğim sınırı 0,8 ve yerel yükselti farkı 50 m üzeri. Arazi kendi veri çözünürlüğünde değerlendirilir; daha küçük engeller çözülemez.',fitRoute:'Rotanın tamamını göster ↗',oneLayer:'Her seferinde tek katman. Veri kümeleri birleştirilmez.',candidate:'Arazi rotası oluşturuldu. Kimyasal güvenlik, radyasyon ve sıcaklık değerlendirilmedi.',allMissing:'Tam güvenlik rotası oluşturulamıyor: kimyasal, radyasyon ve sıcaklık kapsamı eksik.',pickStart:'İki haritadan birinde başlangıç noktasını seçin.',pickEnd:'İki haritadan birinde hedefi seçin.',ready:'NASA arazisi hazır',calculating:'Arazi rotası aranıyor…',badStart:'Geçerli bir başlangıç yeri veya enlem, boylam girin.',badEnd:'Geçerli bir hedef yeri veya enlem, boylam girin.',native:'Arazi örnekleme aralığı',distance:'Mesafe',ascent:'Örneklenen yükselme',maxSlope:'En yüksek örnek eğim',slopeLimit:'Azami eğim sınırı',eta:'Tahmini varış süresi',avgSpeed:'Ortalama hız',gridStep:'Rota arama aralığı',noData:'Veri yok',layerLoading:'Harita katmanı yükleniyor…',surface:'Viking renkli görüntü',relief:'NASA MOLA topografyası',ctx:'CTX görüntüsü',water:'Su eşdeğeri hidrojen',chlorine:'Klor bolluğu',thermal:'Isıl atalet (gece)',radiation:'Radyasyon maruziyeti',temperature:'Yüzey sıcaklığı',cargoTitle:'Kargo ve araç',vehicleType:'Araç türü',vehicleFeet:'Yaya (EVA giysisi)',vehicleRover:'Robotik Keşif Aracı (Perseverance)',vehicleCrewRover:'Mürettebatlı Rover (LRV)',vehicleTruck:'Ağır Kargo Kamyonu (SEV)',cargoWeight:'Kargo ağırlığı (kg)',cargoNote:'Eğim sınırı ve seyir hızı, araç türüne ve kargo kütlesine göre otomatik ayarlanır.',cruiseSpeed:'Nominal hız',reliefThreshold:'Yükselti eşiği',missionStart:'İkmal Görevi',missionPrev:'← Geri',missionNext:'İleri →',missionDone:'Görevi Tamamla'});
let lang='en';try{lang=localStorage.getItem('mars-language')||'en';}catch{}if(!translations[lang])lang='en';const t=key=>translations[lang][key]||key;
let terrain,view,map,catalog=[],layers=[],activeLayer,origin=null,destination=null,selected=null,route=null,pick=null,mode='opening',ready=false,requestId=0,requestController=null,expanded=false,layerRequest=0,missionActive=false,missionStep=0;
function getCargoProfile(){
 const vehicle=$('vehicle-type')?.value||'feet';
 const raw=parseFloat($('cargo-kg')?.value||'0');
 const cargo=Number.isFinite(raw)&&raw>=0?Math.min(100000,raw):0;
 let maxSlope=.8,reliefLimit=50,speed=2.2;
 if(vehicle==='truck'){
  const lf=Math.max(0,(cargo-500)/2500);
  maxSlope=Math.max(.08,.2/(1+.35*lf));
  reliefLimit=25;
  speed=Math.max(3,10/(1+.25*(cargo/1000)));
 }else if(vehicle==='rover'){
  const lf=Math.max(0,(cargo-20)/100);
  maxSlope=Math.max(.18,.5/(1+.4*lf));
  reliefLimit=35;
  speed=Math.max(.05,.152/(1+.3*(cargo/50)));
 }else if(vehicle==='crew-rover'){
  const lf=Math.max(0,(cargo-150)/490);
  maxSlope=Math.max(.16,.466/(1+.35*lf));
  reliefLimit=40;
  speed=Math.max(4,14/(1+.25*(cargo/490)));
 }else{
  if(cargo<=25){maxSlope=.8;reliefLimit=50;speed=Math.max(1.2,2.2-.012*cargo);}
  else{const over=cargo-25;maxSlope=Math.max(.25,.8/(1+over/45));reliefLimit=Math.max(25,50-.25*over);speed=Math.max(.6,1.9/(1+over/50));}
 }
 return {vehicle,cargoKg:cargo,maxSlope,reliefLimit,speed};
}
function updateCargoUI(){
 const p=getCargoProfile(),box=$('cargo-summary');
 if(box){
  box.replaceChildren();
  for(const[label,val]of [[t('slopeLimit'),`${p.maxSlope.toFixed(2)} (dy/dx)`],[t('cruiseSpeed'),`${p.speed<1?p.speed.toFixed(3):p.speed.toFixed(1)} km/h`],[t('reliefThreshold'),`${Math.round(p.reliefLimit)} m`],[t('cargoWeight'),`${Math.round(p.cargoKg)} kg`]]){
   const d=document.createElement('div'),s=document.createElement('small');
   s.textContent=label;d.append(s,document.createTextNode(val));box.append(d);
  }
 }
 const rules=$('route-rules');
 if(rules){
  rules.textContent=lang==='tr'
   ?`Eğim sınırı ${p.maxSlope.toFixed(2)} (dy/dx) ve yerel yükselti farkı ${Math.round(p.reliefLimit)} m üzeri (${t(p.vehicle==='truck'?'vehicleTruck':p.vehicle==='rover'?'vehicleRover':p.vehicle==='crew-rover'?'vehicleCrewRover':'vehicleFeet')}, ${Math.round(p.cargoKg)} kg).`
   :`Slope limit ${p.maxSlope.toFixed(2)} (dy/dx) with local relief above ${Math.round(p.reliefLimit)} m (${t(p.vehicle==='truck'?'vehicleTruck':p.vehicle==='rover'?'vehicleRover':p.vehicle==='crew-rover'?'vehicleCrewRover':'vehicleFeet')}, ${Math.round(p.cargoKg)} kg).`;
 }
}
function formatEta(seconds,sols){
 if(!Number.isFinite(seconds)||seconds<=0)return '0 min';
 const hrs=seconds/3600;
 if(hrs<1)return `${Math.max(1,Math.round(seconds/60))} min`;
 if(hrs<24){const h=Math.floor(hrs),m=Math.round((hrs-h)*60);return `${h}h ${m}m`;}
 return `${hrs.toFixed(1)} h (${(sols??seconds/88775.244).toFixed(2)} sols)`;
}
function localize(){document.documentElement.lang=lang;document.querySelectorAll('[data-i18n]').forEach(e=>e.textContent=t(e.dataset.i18n));$('language').value=lang;for(const id of ['origin','route-start','route-end'])$(id).placeholder=t('placeholder');updateCargoUI();if(layers.length)buildLayerList();if(activeLayer)legend(activeLayer);if(route)showRoute(route);if(selected&&$('landmark-brief')&&!$('location-card').hidden)renderLandmarkBrief(selected);if(missionActive)renderMissionStep(false);status();}
function status(){ $('view-status').textContent=t(mode==='opening'?'orbital':mode==='free'?'roaming':'surfaceView');$('map-type').textContent=$('hud').checked?'HUD':t(activeLayer?.id||'surface').toLocaleUpperCase(lang);}
let noticeTimer;function notice(text){$('notice').textContent=text;$('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').hidden=true,8000);}
function close(id){const el=$(id);if(el)el.hidden=true;const triggers={'settings':'settings-button','layers':'layers-button','route-panel':'destination-button','cargo-panel':'cargo-button'};$(triggers[id])?.setAttribute('aria-expanded','false');}
function toggle(id){const open=$(id).hidden;if(id==='layers'){close('route-panel');close('cargo-panel');}if(id==='cargo-panel'){close('layers');close('route-panel');}if(id==='route-panel'){close('layers');close('cargo-panel');close('settings');}$(id).hidden=!open;const triggers={'settings':'settings-button','layers':'layers-button','route-panel':'destination-button','cargo-panel':'cargo-button'};$(triggers[id])?.setAttribute('aria-expanded',String(open));if(open&&id==='route-panel'){if(!missionActive)$('location-card').hidden=true;setTimeout(()=>$(origin?'route-end':'route-start').focus(),0);}if(open&&missionActive){if(id==='layers'&&missionStep===0)setMissionStep(1);else if(id==='cargo-panel'&&missionStep===1)renderMissionStep(false);else if(id==='route-panel'&&missionStep===2)renderMissionStep(false);}}
$('settings-button').onclick=()=>toggle('settings');$('layers-button').onclick=()=>toggle('layers');$('destination-button').onclick=()=>toggle('route-panel');$('cargo-button').onclick=()=>toggle('cargo-panel');document.querySelectorAll('[data-close]').forEach(e=>e.onclick=()=>close(e.dataset.close));$('sources-button').onclick=()=>$('sources').showModal();$('sources-close').onclick=()=>$('sources').close();
$('language').onchange=e=>{lang=e.target.value;try{localStorage.setItem('mars-language',lang);}catch{}localize();};
function enter(next){mode=next;document.body.classList.toggle('opening',mode==='opening');$('opening-panel').hidden=mode!=='opening';$('map-tools').hidden=mode==='opening';$('exit').hidden=mode==='opening';$('location-card').hidden=mode==='opening'||!selected||missionActive;$('location-label').hidden=mode==='opening'||!origin;if(mode==='opening')closeMission();status();}
function updateEndpoints(){view?.setEndpoints(origin,destination);if(map){map.origin=origin;map.destination=destination;map.draw();}}
function setOrigin(p){origin={...p};$('route-start').value=p.name||coordinate(p);updateEndpoints();}
function setDestination(p){destination={...p};$('route-end').value=p.name||coordinate(p);updateEndpoints();}
function location(p){selected=p;$('location-title').textContent=p.name||coordinate(p);$('location-coordinates').textContent=coordinate(p);$('location-card').hidden=missionActive;}
function renderLandmarkBrief(p){let brief=$('landmark-brief');if(!brief){brief=document.createElement('div');brief.id='landmark-brief';$('location-card').append(brief);}brief.replaceChildren();if(p.photo){const photo=document.createElement('img');photo.src=p.photo;photo.alt=lang==='tr'?`${p.name} NASA görüntüsü`:`NASA view of ${p.name}`;photo.loading='lazy';brief.append(photo);}const history=document.createElement('p');history.textContent=(lang==='tr'&&p.descriptionTr)||p.history||p.note||'';brief.append(history);if(p.source){const source=document.createElement('a');source.href=p.source;source.target='_blank';source.rel='noopener noreferrer';source.textContent=lang==='tr'?'NASA kaynağı ↗':'NASA source ↗';brief.append(source);}}
function showLandmark(p){location(p);renderLandmarkBrief(p);view.flyTo(p);}
const MISSION_LANDING={lat:-4,lon:-137,name:'-4, -137'},MISSION_BASE={lat:33,lon:-146,name:'33, -146'};
function getMissionSteps(){
 return lang==='tr'?[
  {eyebrow:'İKMAL GÖREVİ · KAYIT 01/05',title:'Rotadan Sapan İniş',body:['İkmal kapsülü <b>ARES-4</b> atmosfer girişinde rotasından saptı. Alfa Üssü <code>(33, -146)</code> yerine ekvator yakınlarında <code>(-4, -137)</code> noktasına, hedefin 2.200 km güneyine indik.','Yola çıkmadan önce sağ alttaki <b>Harita Katmanları (▱)</b> düğmesine tıklayarak <b>NASA MOLA topografyası</b> ve yüzey veri katmanlarını inceleyin.'],chips:[{label:'▱ MOLA Topografyasını Aç',run:()=>{const r=layers.find(l=>l.id==='relief');if(r)selectLayer(r);setMissionStep(1);}}]},
  {eyebrow:'İKMAL GÖREVİ · KAYIT 02/05',title:'Kargo ve Araç Ayarları',body:['Acil yaşam destek konteynerlerini taşıyoruz. Sağ alttaki <b>Kargo ve Araç (⛟)</b> düğmesini açın.','<b>Ağır Kargo Kamyonu (SEV)</b> gibi bir araç seçip kargo ağırlığını (ör. <code>1200 kg</code>) girin. Maksimum güvenli eğimin <code>0,20 (dy/dx)</code> sınırına göre otomatik güncellendiğini göreceksiniz.'],chips:[{label:'⛟ Ağır Kamyon · 1200 kg Ayarla',run:()=>{$('vehicle-type').value='truck';$('cargo-kg').value='1200';updateCargoUI();if($('cargo-panel').hidden)toggle('cargo-panel');setMissionStep(2);}}]},
  {eyebrow:'İKMAL GÖREVİ · KAYIT 03/05',title:'Alfa Üssü Koordinatlarını Girin',body:['Şimdi <b>Rota Oluştur (⌕)</b> panelini açın.','Başlangıç noktası (<b>A</b>) olarak yanlış iniş konumumuz <code>-4, -137</code> ve hedef (<b>B</b>) olarak Alfa Üssü <code>33, -146</code> koordinatlarını girin veya aşağıdaki hızlı doldurma düğmesini kullanın.'],chips:[{label:'⌖ (-4, -137) → (33, -146) Doldur',run:()=>{if($('route-panel').hidden)toggle('route-panel');setOrigin(MISSION_LANDING);setDestination(MISSION_BASE);setMissionStep(3);}}]},
  {eyebrow:'İKMAL GÖREVİ · KAYIT 04/05',title:'Güvenlik Değerlendirmesi ve Rota Hesabı',body:['Rota panelindeki <b>Değerlendirme</b> seçeneğine göz atın: <b>Tüm güvenlik katmanlarını gerektir</b> seçildiğinde tüm tehlike kutucukları işaretlenir; <b>Arazi rotası</b> ise NASA MOLA eğim sınırlarını kullanır.','<b>Rotayı hesapla</b> düğmesine basarak dik yamaçları aşan Bézier eğrili güvenli rotayı oluşturun.'],chips:[{label:'↗ Rotayı Şimdi Hesapla',run:()=>{if($('route-panel').hidden)toggle('route-panel');if(!origin)setOrigin(MISSION_LANDING);if(!destination)setDestination(MISSION_BASE);$('route-mode').value='terrain';$('route-mode').dispatchEvent(new Event('change'));$('route-form').requestSubmit();}}]},
  {eyebrow:'İKMAL GÖREVİ · KAYIT 05/05',title:'İkmal Rotası Kilitlendi',body:['Yol bulma tamamlandı! Algoritma <code>(-4, -137)</code> iniş noktasından Alfa Üssü <code>(33, -146)</code> konumuna aracınızın eğim sınırını aşmadan güvenli bir rota çizdi.','Rota panelinden <b>Mesafe</b>, <b>Tahmini varış süresi (ETA)</b> ve <b>Azami eğim</b> verilerini inceleyebilir veya tüm rotayı ekrana sığdırabilirsiniz.'],chips:[{label:'Rotanın tamamını göster ↗',run:()=>$('fit-route').click()}]}
 ]:[
  {eyebrow:'SUPPLY MISSION · LOG 01/05',title:'Off-Course Touchdown',body:['Resupply capsule <b>ARES-4</b> overshot its entry trajectory. Instead of touching down at Base Alpha <code>(33, -146)</code>, we landed far south at <code>(-4, -137)</code> across rugged volcanic plains.','First, click the <b>Map Layers (▱)</b> button on the bottom-right to inspect <b>NASA MOLA topography</b> and orbital hazard datasets.'],chips:[{label:'▱ Switch to MOLA Topography',run:()=>{const r=layers.find(l=>l.id==='relief');if(r)selectLayer(r);setMissionStep(1);}}]},
  {eyebrow:'SUPPLY MISSION · LOG 02/05',title:'Configure Vehicle & Cargo',body:['We are hauling emergency resupply crates for Base Alpha. Click the <b>Cargo & Vehicle (⛟)</b> button on the bottom-right.','Select your vehicle (such as <b>Heavy Cargo Truck</b>) and input your cargo mass in kg. Notice how the pathfinder automatically tightens the maximum slope limit (<code>≤ 0.20 dy/dx</code> for trucks) and adjusts cruise speed.'],chips:[{label:'⛟ Set Heavy Truck · 1200 kg',run:()=>{$('vehicle-type').value='truck';$('cargo-kg').value='1200';updateCargoUI();if($('cargo-panel').hidden)toggle('cargo-panel');setMissionStep(2);}}]},
  {eyebrow:'SUPPLY MISSION · LOG 03/05',title:'Enter Base Alpha Coordinates',body:['Open the <b>Route Planner (⌕)</b> button next to Cargo settings.','Input our off-course landing site <code>-4, -137</code> as <b>Starting point (A)</b> and Base Alpha <code>33, -146</code> as <b>Destination (B)</b>—or click the quick-fill button below.'],chips:[{label:'⌖ Fill (-4, -137) → (33, -146)',run:()=>{if($('route-panel').hidden)toggle('route-panel');setOrigin(MISSION_LANDING);setDestination(MISSION_BASE);setMissionStep(3);}}]},
  {eyebrow:'SUPPLY MISSION · LOG 04/05',title:'Hazard Assessment & Pathfinding',body:['In the Route Planner, try switching <b>Assessment</b> between <b>Require all safety layers</b> (which visually checks every hazard layer) and <b>Terrain candidate</b>.','With <b>Terrain candidate</b> selected, click <b>Calculate route</b> to compute a Bézier-curved path that detours around steep Martian scarps.'],chips:[{label:'↗ Calculate Route Now',run:()=>{if($('route-panel').hidden)toggle('route-panel');if(!origin)setOrigin(MISSION_LANDING);if(!destination)setDestination(MISSION_BASE);$('route-mode').value='terrain';$('route-mode').dispatchEvent(new Event('change'));$('route-form').requestSubmit();}}]},
  {eyebrow:'SUPPLY MISSION · LOG 05/05',title:'Resupply Route Locked',body:['Pathfinding verified! The router charted a smooth cubic-Bézier trajectory from <code>(-4, -137)</code> to Base Alpha <code>(33, -146)</code> within your vehicle and cargo slope constraints.','Review your <b>Estimated Arrival Time (ETA)</b>, total distance, and sampled ascent in the Route Planner, or frame the full journey across Mars.'],chips:[{label:'Show entire route ↗',run:()=>$('fit-route').click()}]}
 ];
}
function renderMissionStep(animate=true){
 if(!missionActive)return;
 const steps=getMissionSteps(),step=steps[missionStep]||steps[0];
 $('mission-panel').hidden=false;
 $('location-card').hidden=true;
 $('mission-eyebrow').textContent=step.eyebrow;
 $('mission-title').textContent=step.title;
 const body=$('mission-body');
 body.replaceChildren();
 if(animate){body.classList.remove('mission-slide');void body.offsetWidth;body.classList.add('mission-slide');}
 for(const paragraph of step.body){const p=document.createElement('p');p.innerHTML=paragraph;body.append(p);}
 const quick=$('mission-quick');
 quick.replaceChildren();
 quick.hidden=!step.chips?.length;
 for(const chip of step.chips||[]){const b=document.createElement('button');b.type='button';b.className='mission-chip';b.textContent=chip.label;b.onclick=chip.run;quick.append(b);}
 const dots=$('mission-dots');
 dots.replaceChildren();
 for(let i=0;i<steps.length;i++){const dot=document.createElement('i');if(i===missionStep)dot.className='active';dots.append(dot);}
 $('mission-prev').hidden=missionStep===0;
 $('mission-next').textContent=missionStep===steps.length-1?t('missionDone'):t('missionNext');
}
function setMissionStep(next){
 const steps=getMissionSteps();
 missionStep=clamp(next,0,steps.length-1);
 renderMissionStep(true);
}
function closeMission(){
 missionActive=false;
 if($('mission-panel'))$('mission-panel').hidden=true;
}
function startMission(){
 if(!ready){notice(t('loading'));return;}
 clearRoute();
 missionActive=true;
 missionStep=0;
 origin=null;
 destination=null;
 selected=null;
 $('route-start').value='';
 $('route-end').value='';
 updateEndpoints();
 enter('surface');
 view.mode='surface';
 view.flyTo(MISSION_LANDING);
 renderMissionStep(true);
}
$('mission-button').onclick=startMission;
$('mission-close').onclick=closeMission;
$('mission-prev').onclick=()=>{if(missionStep>0)setMissionStep(missionStep-1);};
$('mission-next').onclick=()=>{const steps=getMissionSteps();if(missionStep<steps.length-1)setMissionStep(missionStep+1);else closeMission();};
$('origin-form').onsubmit=e=>{e.preventDefault();if(!ready){notice(t('loading'));return;}const p=parsePoint($('origin').value,catalog);if(!p){notice(t('invalid'));$('origin').focus();return;}closeMission();setOrigin(p);location(p);enter('surface');view.mode='surface';view.flyTo(p);};
$('free-roam').onclick=()=>{if(!ready)return;closeMission();origin=null;destination=null;selected=null;enter('free');view.onlandmark=showLandmark;view.setLandmarks(catalog);view.free();updateEndpoints();};
$('exit').onclick=()=>{cancelRequest();clearRoute();closeMission();origin=null;destination=null;selected=null;view.home();map.setView({lat:0,lon:0},360);$('route-start').value='';$('route-end').value='';close('route-panel');close('layers');close('cargo-panel');setExpanded(false);enter('opening');};
function onPick(p){if(pick){p.name=`${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`;if(pick==='start')setOrigin(p);else setDestination(p);pick=null;document.body.classList.remove('picking');$('pick-hint').hidden=true;$('pick-start').classList.remove('active');$('pick-end').classList.remove('active');$('route-panel').hidden=false;$('destination-button').setAttribute('aria-expanded','true');if(missionActive&&missionStep===2&&origin&&destination)setMissionStep(3);}else if(mode!=='opening')view.setView(p,view.altitude);}
function pickPoint(which){pick=which;close('route-panel');close('cargo-panel');document.body.classList.add('picking');$('pick-'+which).classList.add('active');$('pick-hint').textContent=t(which==='start'?'pickStart':'pickEnd');$('pick-hint').hidden=false;notice(t(which==='start'?'pickStart':'pickEnd'));}
$('pick-start').onclick=()=>pickPoint('start');$('pick-end').onclick=()=>pickPoint('end');
function setExpanded(value){expanded=value;document.body.classList.toggle('expanded-map',value);$('expand-map').setAttribute('aria-label',value?'Collapse 2D map':'Expand 2D map');$('expand-map').textContent=value?'⊡':'⛶';requestAnimationFrame(()=>map?.draw());}
$('expand-map').onclick=()=>setExpanded(!expanded);$('map-plus').onclick=()=>map.zoom(.5);$('map-minus').onclick=()=>map.zoom(2);$('map-home').onclick=()=>{view.setView({lat:0,lon:0},R*5);map.setView({lat:0,lon:0},360);};
$('hud').onchange=e=>{document.body.classList.toggle('hud',e.target.checked);view?.setHud(e.target.checked);if(map){map.hud=e.target.checked;map.draw();}status();};
function cancelRequest(){requestId++;requestController?.abort();requestController=null;$('calculate-route').disabled=false;$('calculate-route').textContent=t('calculate');}
function clearRoute(){cancelRequest();route=null;view?.setRoute([],null);if(map){map.route=[];map.bezierRoute=null;map.draw();}$('route-message').textContent='';$('route-stats').hidden=true;$('fit-route').hidden=true;}
$('clear-route').onclick=clearRoute;
for(const id of ['route-start','route-end','route-mode'])$(id).addEventListener('input',()=>{if(requestController){cancelRequest();$('route-message').textContent='';}if(missionActive&&missionStep===2&&(id==='route-start'||id==='route-end')){const a=parsePoint($('route-start').value,catalog),b=parsePoint($('route-end').value,catalog);if(a&&b){setOrigin(a);setDestination(b);setMissionStep(3);}}});
for(const id of ['vehicle-type','cargo-kg'])$(id).addEventListener('input',()=>{updateCargoUI();if(missionActive&&missionStep===1)setMissionStep(2);if(route&&origin&&destination&&!$('route-panel').hidden)$('route-form').requestSubmit();});
$('route-form').onsubmit=async e=>{e.preventDefault();if(!ready)return;const a=parsePoint($('route-start').value,catalog),b=parsePoint($('route-end').value,catalog);if(!a){$('route-message').textContent=t('badStart');$('route-start').focus();return;}if(!b){$('route-message').textContent=t('badEnd');$('route-end').focus();return;}const cargo=getCargoProfile();clearRoute();setOrigin(a);setDestination(b);requestController=new AbortController();const id=++requestId;$('calculate-route').disabled=true;$('calculate-route').textContent=t('calculating');$('route-message').textContent=t('calculating');try{const response=await fetch('/api/route',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({start:a,end:b,mode:$('route-mode').value,vehicle:cargo.vehicle,cargoKg:cargo.cargoKg}),signal:requestController.signal});const result=await response.json();if(id!==requestId)return;if(!response.ok&&result.error)throw Error(result.error);route=result;if(result.points?.length){playRouteSound();view.setRoute(result.points,result.bezierPoints);map.route=result.points;map.bezierRoute=result.bezierPoints||null;map.draw();$('fit-route').hidden=false;if(missionActive&&missionStep<=3)setMissionStep(4);}showRoute(result);}catch(error){if(error.name!=='AbortError'&&id===requestId)$('route-message').textContent=t('routeError');}finally{if(id===requestId){requestController=null;$('calculate-route').disabled=false;$('calculate-route').textContent=t('calculate');}}};
function showRoute(result){const p=getCargoProfile();$('route-message').textContent=result.status==='candidate'?t('candidate'):result.status==='unavailable'&&result.missing?t('allMissing'):result.message||t('routeError');$('route-stats').replaceChildren();$('route-stats').hidden=!result.points?.length;if(result.points?.length){const items=[[t('distance'),`${(result.distanceM/1000).toFixed(1)} km`],[t('eta'),formatEta(result.etaSeconds,result.etaSols)],[t('avgSpeed'),`${(result.averageSpeedKmh||p.speed).toFixed(result.averageSpeedKmh<1?2:1)} km/h`],[t('ascent'),`${Math.round(result.ascentM||0)} m`],[t('maxSlope'),`${(result.maxSampledSlope||0).toFixed(3)} / ${(result.maxSlopeLimit||p.maxSlope).toFixed(2)}`],[t('native'),`${Math.round(result.resolutionM)} m`]];for(const[label,value]of items){const cell=document.createElement('div'),small=document.createElement('small');small.textContent=label;cell.append(small,document.createTextNode(value));$('route-stats').append(cell);}}}
$('fit-route').onclick=()=>{if(!route?.points?.length)return;const a=route.points[0],b=route.points.at(-1),center=interpolate(a,b,.5),span=clamp(distance(a,b)/1000/R*180/Math.PI*1.8,.1,300);view.setView(center,clamp(R*Math.tan(Math.min(150,span)*Math.PI/360)/Math.tan(21*Math.PI/180),.1,R*5));map.setView(center,span);};
function buildLayerList(){const list=$('layer-list');list.replaceChildren();for(const layer of layers.filter(layer=>layer.available!==false)){const button=document.createElement('button');button.type='button';button.className='layer'+(activeLayer?.id===layer.id?' active':'');button.dataset.layer=layer.id;const label=document.createElement('span'),small=document.createElement('small'),check=document.createElement('b');label.textContent=t(layer.id);small.textContent=layer.subtitle||layer.unit||'NASA';check.textContent=activeLayer?.id===layer.id?'✓':'';button.append(label,small,check);button.onclick=()=>{selectLayer(layer);if(missionActive&&missionStep===0)setMissionStep(1);};list.append(button);}}
const images=new Map();function loadImage(path){if(images.has(path))return images.get(path);const promise=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=path;});images.set(path,promise);return promise;}
async function selectLayer(layer){const id=++layerRequest;close('layers');notice(t('layerLoading'));try{const image=await loadImage(layer.texture);if(id!==layerRequest)return;activeLayer=layer;await view.setLayer(layer,image);map.setLayer(layer,image);buildLayerList();legend(layer);status();$('notice').hidden=true;}catch{notice(t('error'));}}
function legend(layer){$('map-legend').replaceChildren();$('layer-unit').textContent=layer.unit||'NASA';const scale=layer.colorScale||[];if(scale.length){const ramp=document.createElement('div');ramp.className='ramp';const min=scale[0].value,max=scale.at(-1).value;ramp.style.background=`linear-gradient(90deg,${scale.map(s=>s.color+' '+(s.value-min)/(max-min)*100+'%').join(',')})`;$('map-legend').append(ramp);const ends=document.createElement('div');ends.className='ends';for(const value of [min,max]){const span=document.createElement('span');span.textContent=String(value);ends.append(span);}$('map-legend').append(ends);}const note=document.createElement('p');note.textContent=layer.legendNote||layer.subtitle||'';$('map-legend').append(note);}
function addSource(source){const box=document.createElement('div');box.className='source';const a=document.createElement('a');a.href=source.url||source.source;a.textContent=source.title||source.label;a.target='_blank';a.rel='noopener noreferrer';const p=document.createElement('p');p.textContent=source.note||source.coverageNote||'';box.append(a,p);$('source-list').append(box);}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){close('layers');close('cargo-panel');close('settings');close('route-panel');pick=null;document.body.classList.remove('picking');$('pick-hint').hidden=true;}});
function installHazardAssessment(){const field=document.createElement('fieldset');field.id='hazard-assessment';field.innerHTML='<legend>Hazard assessment</legend><p>Toggle layers you want reported. Only terrain slope and relief constrain the route; the other NASA maps have no mission-approved exclusion thresholds.</p><label><input type="checkbox" checked data-hazard="Slope and local relief"> Slope and local relief (used for routing)</label><label><input type="checkbox" data-hazard="Water-equivalent hydrogen"> Water-equivalent hydrogen</label><label><input type="checkbox" data-hazard="Chlorine abundance"> Chlorine abundance</label><label><input type="checkbox" data-hazard="Thermal inertia (night)"> Thermal inertia (night)</label><label><input type="checkbox" data-hazard="Thermal inertia (day)"> Thermal inertia (day)</label>';$('route-mode').insertAdjacentElement('afterend',field);const boxes=[...field.querySelectorAll('input[type="checkbox"]')];let savedStates=boxes.map(b=>b.checked),lastMode=$('route-mode').value;for(const box of boxes)box.addEventListener('change',()=>{if($('route-mode').value!=='all')savedStates=boxes.map(b=>b.checked);});$('route-mode').addEventListener('change',()=>{const nextMode=$('route-mode').value;if(nextMode==='all'&&lastMode!=='all'){savedStates=boxes.map(b=>b.checked);for(const b of boxes)b.checked=true;}else if(nextMode!=='all'&&lastMode==='all'){boxes.forEach((b,i)=>{b.checked=Boolean(savedStates[i]);});}lastMode=nextMode;});}
installHazardAssessment();localize();
async function init(){try{const [base,high,hazards]=await Promise.all(['assets/catalog.json','assets/hires/manifest.json','assets/hazards/manifest.json'].map(url=>fetch(url).then(r=>{if(!r.ok)throw Error(url);return r.json();})));catalog=base.landmarks;for(const p of catalog){const option=document.createElement('option');option.value=p.name;$('landmarks').append(option);}layers=[{id:'surface',texture:high.surface,tiles:high.surfaceTiles,subtitle:'NASA Viking · native image tiles',legendNote:'Color mosaic · geographic context'},{id:'relief',texture:high.relief,tiles:high.reliefTilesWMTS,gridTiles:high.reliefTiles,subtitle:'NASA MOLA · official color hillshade (463 m)',unit:'m / areoid',colorScale:high.reliefScale.map(s=>({value:s.meters,color:s.color})),legendNote:'Official NASA MGS MOLA color-coded shaded relief'}];if(high.ctxSurface)layers.push({id:'ctx',texture:high.ctxSurface,tiles:high.ctxTiles,subtitle:'NASA MRO / CTX · 5 m grayscale tile pyramid',legendNote:'NASA CTX mosaic · native 512px tile streaming'});for(const layer of hazards.layers)layers.push({...layer,subtitle:layer.available===false?'':`${layer.width} × ${layer.height} · ${layer.unit}`,legendNote:layer.available===false?'':`${layer.id==='thermal'?'Thermal inertia, NOT temperature. ':''}Gray: no data · ${Math.round(layer.validFraction*100)}% coverage`});for(const s of [...base.sources,...high.sources,...hazards.layers])addSource(s);terrain=new Terrain(high);await terrain.load();map=new Map2D($('mini'),{onview:(center,span)=>{if(!view)return;const altitude=clamp(R*Math.tan(Math.min(span,150)*Math.PI/360)/Math.tan(21*Math.PI/180),MarsView.MIN_CAMERA_ALTITUDE_KM,R*5);view.setView(center,altitude,false);$('mini-coordinates').textContent=coordinate(center);},onpick:onPick});view=new MarsView($('viewport'),terrain,{onview:(center,alt,span)=>{map.setView(center,span);$('mini-coordinates').textContent=coordinate(center);$('altitude').textContent=`${alt.toFixed(0)} km`;$('terrain-resolution').textContent=`${t('native')}: ${Math.round(terrain.resolution(center.lat,center.lon))} m`;},onpick:onPick,onframe:position=>{$('location-label').hidden=!position.visible||mode==='opening';if(position.visible){$('location-label').style.left=`${position.x}px`;$('location-label').style.top=`${position.y-20}px`;}}});await view.setNormal(high.normal);await selectLayer(layers[0]);ready=true;$('loading').hidden=true;map.setView({lat:0,lon:0},360);buildLayerList();}catch(error){$('loading-text').textContent=t('error');notice(`${t('error')} ${error.message||''}`);console.error(error);}}
init();
