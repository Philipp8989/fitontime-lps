export const QUESTIONS = [
  {title:'Wie oft bist du abends müde, aber dein Kopf hört einfach nicht auf?', options:['Selten. Ich komme gut runter.','An manchen Tagen.','Mehrmals pro Woche.','Fast jeden Abend.'], hint:'Abends abschalten', weight:16},
  {title:'Wie häufig wachst du morgens auf und fühlst dich nicht richtig erholt?', options:['Fast nie.','Hin und wieder.','An vielen Morgen.','Praktisch jeden Morgen.'], hint:'Nicht erholt aufwachen', weight:15},
  {title:'Wie oft läuft dein Essen nach einem stressigen Tag anders als geplant?', options:['Selten.','Ab und zu.','Mehrmals pro Woche.','Fast immer bei Stress.'], hint:'Essen nach Stress', weight:17},
  {title:'Wie häufig greifst du abends zu Süssem oder Salzigem, obwohl du satt bist?', options:['Fast nie.','Gelegentlich.','Oft.','An fast jedem Abend.'], hint:'Snacks trotz Sättigung', weight:13},
  {title:'Wie oft kommt am Nachmittag ein richtiges Energietief?', options:['Selten.','Manchmal.','An vielen Tagen.','Nahezu täglich.'], hint:'Nachmittags erschöpft', weight:13},
  {title:'Wie oft merkst du, dass Kleinigkeiten dich schneller reizen als sonst?', options:['Selten.','Manchmal.','Ziemlich oft.','Fast jeden Tag.'], hint:'Schnell gereizt', weight:12},
  {title:'Was passiert mit deinem Abnehmplan, wenn eine stressige Woche kommt?', options:['Er bleibt meistens machbar.','Ein paar Mahlzeiten geraten durcheinander.','Ich verliere meinen Rhythmus.','Ich breche meistens ab und starte neu.'], hint:'Abnehmplan kippt bei Stress', weight:14}
];
export function evaluate(answers) {
  if (!Array.isArray(answers) || answers.length !== QUESTIONS.length || answers.some(x=>!Number.isInteger(x) || x<0 || x>3)) throw new Error('Ungültige Antworten');
  const score=Math.round(QUESTIONS.reduce((acc,q,i)=>acc+(answers[i]/3)*q.weight,0));
  const sorted=QUESTIONS.map((q,i)=>({i, label:q.hint, choice:answers[i], impact:q.weight*answers[i]/3})).filter(x=>x.choice>=2).sort((a,b)=>b.impact-a.impact);
  const level=score >= 67 ? 'hoch' : score >= 34 ? 'mittel' : 'niedrig';
  return {score,level,notices:sorted.slice(0,2),answers};
}
export const EVENT = {
  name:'FIT on TIME – Reset-Abend', date:'Dienstag, 27. Oktober 2026', time:'19:00–20:30 Uhr',
  directLiveLink:'https://event.webinarjam.com/z21lv/go/live/kzwkxs3ins2s1'
};
