
function loadConfig(){
 const d=localStorage.getItem('t2c_config');
 return d?JSON.parse(d):null;
}
function saveSettings(){
 const cfg={
  priority1:document.getElementById('p1').value,
  priority2:document.getElementById('p2').value,
  priority3:document.getElementById('p3').value
 };
 localStorage.setItem('t2c_config',JSON.stringify(cfg));
 alert('Settings saved');
}
