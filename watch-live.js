// watch-live.js - ejecutar en otra terminal mientras corre el tracker
const fs = require('fs');
const path = require('path');

const MATCH_ID = 231637;
const LIVE_FILE = path.join('./data', `live_${MATCH_ID}.json`);

console.log('📡 Monitoreando partido en vivo...');
console.log('Presiona Ctrl+C para salir\n');

let lastPoints = 0;

setInterval(() => {
  try {
    if (fs.existsSync(LIVE_FILE)) {
      const data = JSON.parse(fs.readFileSync(LIVE_FILE, 'utf-8'));
      
      if (data.totalPoints !== lastPoints) {
        lastPoints = data.totalPoints;
        
        // Limpiar consola (opcional)
        console.clear();
        
        console.log('='.repeat(50));
        console.log(`🏐 PARTIDO EN VIVO - SET ${data.currentSet}`);
        console.log('='.repeat(50));
        console.log(`\n📊 MARCADOR: ${data.currentScore.home} - ${data.currentScore.away}`);
        console.log(`🔥 RACHA: LOCAL ${data.currentRun.home} | VISITANTE ${data.currentRun.away}`);
        console.log(`📈 MOMENTUM: ${data.momentumText}`);
        console.log(`📊 ÚLTIMOS 10: LOCAL ${data.last10Dominance.home} - ${data.last10Dominance.away} VISITANTE`);
        console.log(`⚡ BREAKS: ${data.breaksToday}`);
        console.log(`🎯 TOTAL PUNTOS: ${data.totalPoints}`);
        console.log(`\n⏰ Última actualización: ${new Date(data.timestamp).toLocaleTimeString()}`);
        console.log('='.repeat(50));
      }
    }
  } catch (error) {
    // Esperando datos...
  }
}, 2000);