import {QUESTIONS,evaluate} from './quiz-data.js';
const $=id=>document.getElementById(id);
let answers;try{answers=JSON.parse(sessionStorage.getItem('fitQuizAnswers')||'null')}catch{};
let result;try{result=evaluate(answers)}catch{location.replace('/nervensystem-b/');throw Error('Quiz noch nicht ausgefüllt');}
const head={hoch:'Deine Antworten zeigen eine hohe Belastung.',mittel:'Deine Antworten zeigen mehrere Stresssignale.',niedrig:'Du hast eher wenige Stresssignale angegeben.'};
const sub={hoch:'Häufig müde, schnell gereizt oder abends auf der Suche nach einer Pause? Bei dir zeigen sich deutliche Hinweise auf wenig Erholung.',mittel:'Einige deiner Antworten passen zu Tagen, an denen Stress, Hunger und Erholung durcheinandergeraten.',niedrig:'Stress scheint nach deinen Antworten nicht durchgehend im Vordergrund zu stehen. Beim Abnehmen können dennoch mehrere Faktoren zusammenspielen.'};
$('result-heading').textContent=head[result.level];$('result-sub').textContent=sub[result.level];$('score').textContent=result.score;$('score-level').textContent=({hoch:'Hohe Belastung',mittel:'Erhöhte Belastung',niedrig:'Wenig Hinweise'})[result.level];$('score-bar').style.width=result.score+'%';
const notices=result.notices.map(n=>QUESTIONS[n.i].hint);const lines=notices.length?notices:['Du hast nur wenige der abgefragten Belastungszeichen angegeben.','Ein einzelnes Symptom sagt wenig über deinen Stoffwechsel aus.'];lines.slice(0,2).forEach(t=>{const d=document.createElement('div');d.textContent='✓  '+t;$('notices').append(d)});
const form=$('register-form'),error=$('form-error'),button=$('submit-btn');
let submitting=false;
form.addEventListener('submit',async ev=>{
 ev.preventDefault();if(submitting)return;error.hidden=true;
 const fields=['firstName','lastName','email','phone']; for(const id of fields){const el=$(id);if(!el.value.trim()||!el.checkValidity()){el.focus();error.textContent='Bitte fülle die Pflichtfelder korrekt aus.';error.hidden=false;return;}}
 if(!$('privacy').checked){$('privacy').focus();error.textContent='Bitte stimme der Datenschutzerklärung zu.';error.hidden=false;return;}
 if($('website').value)return;
 let phoneNumber=$('phone').value.replace(/\D/g,'').replace(/^0+/,'');
 const rawDial=$('dial').value.slice(1);if(phoneNumber.startsWith(rawDial)&&phoneNumber.length>rawDial.length+8)phoneNumber=phoneNumber.slice(rawDial.length);if(phoneNumber.length<6||phoneNumber.length>16){error.textContent='Bitte gib eine gültige Handynummer ein.';error.hidden=false;$('phone').focus();return;}
 submitting=true;button.disabled=true;button.textContent='Dein Platz wird reserviert …';
 let registrationId=sessionStorage.getItem('fitRegistrationId');if(!registrationId){registrationId=crypto.randomUUID();sessionStorage.setItem('fitRegistrationId',registrationId);}
 const fullPhone=$('dial').value+phoneNumber;
 const payload={requestId:registrationId,firstName:$('firstName').value.trim(),lastName:$('lastName').value.trim(),email:$('email').value.trim(),phoneCountryCode:$('dial').value,phoneNumber,whatsappConsent:$('whatsapp').checked,privacyConsent:true,answers:result.answers,source:'nervensystem-quiz'};
 try{
  const labels={score:result.score,level:result.level};QUESTIONS.forEach((q,i)=>{labels['q'+(i+1)+'_label']=q.options[result.answers[i]]});
  const response=await fetch('/api/sheets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lp_slug:'nervensystem-b',lp_name:'Nervensystem-Quiz B (Kevin)',name:payload.firstName+' '+payload.lastName,first_name:payload.firstName,email:payload.email,phone:fullPhone,wa_ok:payload.whatsappConsent,answers:labels})});
  const data=await response.json();
  if(!response.ok||!data.ok)throw new Error(response.status===400?(window.__lpErr?window.__lpErr('Bitte prüfe Name, E-Mail und Handynummer.'):'Bitte prüfe Name, E-Mail und Handynummer.'):'Die Anmeldung konnte noch nicht abgeschlossen werden.');
  window.fotB&&window.fotB('lead_submit',{detail:result.level});
  const info={firstName:payload.firstName,liveLink:data.liveLink,registered:true,sheetStatus:data.sheetStatus||'ok'};
  sessionStorage.setItem('fitRegistration',JSON.stringify(info));setTimeout(()=>{location.href='/nervensystem-b/danke/'},250);
 }catch(e){error.textContent=e.message||'Bitte versuche es erneut.';error.hidden=false;button.disabled=false;button.innerHTML='Erneut versuchen →';submitting=false;}
});
