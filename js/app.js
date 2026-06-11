
const def={priority1:'Polity',priority2:'Modern History',priority3:'HL1'};
const cfg=loadConfig()||def;
p1.value=cfg.priority1;p2.value=cfg.priority2;p3.value=cfg.priority3;
summary.textContent=`Current Focus: ${cfg.priority1} | ${cfg.priority2} | ${cfg.priority3}`;
plannerItems(cfg).forEach(t=>{const li=document.createElement('li');li.textContent='□ '+t;tasks.appendChild(li);});
