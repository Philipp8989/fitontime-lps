import {EVENT} from './quiz-data.js';
let info={};try{info=JSON.parse(sessionStorage.getItem('fitRegistration')||'{}')}catch{}
if(!info.registered){location.replace('/nervensystem-b/');}
const link=(typeof info.liveLink==='string'&&/^https:\/\/([a-z0-9-]+\.)*webinarjam\.com\//i.test(info.liveLink))?info.liveLink:EVENT.directLiveLink;
const $=id=>document.getElementById(id);$('name').textContent=info.firstName?', '+info.firstName:'';
$('live-link').href=link;$('link-text').textContent=link;
const description='Kostenloser FIT on TIME Reset-Abend: Stoffwechsel, Insulin, Cortisol und Nervensystem.\nDein Live-Zugang: '+link;
const dates='20261027T180000Z/20261027T193000Z';const gp=new URL('https://calendar.google.com/calendar/render');gp.searchParams.set('action','TEMPLATE');gp.searchParams.set('text','FIT on TIME – Reset-Abend');gp.searchParams.set('dates',dates);gp.searchParams.set('details',description);gp.searchParams.set('location',link);$('google-link').href=gp.toString();
function escapeICS(x){return String(x).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;')}
const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//FIT on TIME//Reset-Abend//DE','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:fit-on-time-reset-abend-20261027@fitontime.ch','DTSTAMP:20261008T100000Z','DTSTART:20261027T180000Z','DTEND:20261027T193000Z','SUMMARY:FIT on TIME – Reset-Abend','DESCRIPTION:'+escapeICS(description),'LOCATION:'+escapeICS(link),'URL:'+link,'END:VEVENT','END:VCALENDAR'].join('\r\n');
const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'});const url=URL.createObjectURL(blob);$('ics-link').href=url;window.addEventListener('pagehide',()=>URL.revokeObjectURL(url),{once:true});
if(info.sheetStatus==='pending'){$('sync-note').hidden=false;$('sync-note').textContent='Dein Webinarplatz ist bestätigt. Die interne Teilnehmerliste wird noch abgeglichen.';}
