# 🏐 VoleyInsight

Sistema de análisis de partidos de voleibol en tiempo real.

## 📋 Características

- 📊 Dashboard en vivo (marcador, rachas, eficiencia)
- 👕 Estadísticas por jugador (puntos, ataques, bloqueos, aces)
- 📈 Análisis evolutivo (comparativa entre partidos)
- 📄 Reporte descargable en HTML
- 📱 Acceso desde celular vía túnel Cloudflare

## 🚀 Inicio rápido

```bash
# Instalar dependencias
npm install

# Iniciar el sistema
iniciar-partido.bat
⚙️ Configuración
Editar data/config.json:

json
{
  "matchId": 123456,
  "homeTeam": "Equipo Local",
  "awayTeam": "Equipo Visitante",
  "categoria": "sub_21"
}
📱 Acceso remoto
Ejecutar iniciar-partido.bat

Copiar la URL de Cloudflare (se muestra en la consola)

Abrir desde el celular: https://xxxx.trycloudflare.com/dashboard/index.html

📄 Reportes
Al finalizar el partido, hacer clic en "💾 Guardar" para descargar el reporte HTML.

📞 Contacto
Gonzalo - 1151364852