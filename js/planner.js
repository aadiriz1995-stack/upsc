
function plannerItems(cfg){
 const day=(new Date()).getDay();
 let items=[
 cfg.priority1+' Lecture',
 cfg.priority2+' Lecture',
 cfg.priority3+' Lecture',
 'Newspaper','Current Affairs','30 MCQs','2 Answer Writing'
 ];
 if(day===6) items.push('CA Revision','Newspaper Revision');
 if(day===0) items.push('GS Revision','Weekly Review','1 hr Test');
 return items;
}
