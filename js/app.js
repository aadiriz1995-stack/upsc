
async function load(){
 const cfg=await fetch('data/config.json').then(r=>r.json());
 const prof=await fetch('data/profile.json').then(r=>r.json());
 document.getElementById('p1').textContent=cfg.priority1;
 document.getElementById('p2').textContent=cfg.priority2;
 document.getElementById('p3').textContent=cfg.priority3;
 document.getElementById('streak').textContent=prof.missionStreak;
 const exam=new Date(cfg.examDate);const today=new Date();
 today.setHours(0,0,0,0);exam.setHours(0,0,0,0);
 document.getElementById('countdown').textContent=Math.ceil((exam-today)/86400000)+' Days Left';
 const start=new Date(prof.missionStartDate);start.setHours(0,0,0,0);
 document.getElementById('day').textContent='Mission Day '+(Math.floor((today-start)/86400000)+1)+' / '+cfg.missionDays;
 const items=[
 cfg.priority1+' Lecture',
 cfg.priority2+' Lecture',
 cfg.priority3+' Lecture',
 'Newspaper','Current Affairs',
 cfg.dailyMCQTarget+' MCQs',
 cfg.dailyAnswerTarget+' Answer Writing'
 ];
 const ul=document.getElementById('planner');
 items.forEach(t=>{let li=document.createElement('li');li.textContent='□ '+t;ul.appendChild(li);});
}
load();
