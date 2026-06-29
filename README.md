# 🏐 VoleyInsight

Sistema de análisis de partidos de voleibol en tiempo real.

## 📋 Características

### 📊 Dashboard en vivo
- Marcador actualizado punto a punto
- Rachas y momentum del partido
- Eficiencia general (porcentaje de puntos ganados)

### 📥 Estadísticas avanzadas
- **Recepción (REC+, REC-)**: calidad de recepción por jugador
- **Defensa (DEF+, DEF-)**: calidad defensiva por jugador
- **Sideout%**: eficiencia cuando el equipo tiene el saque
- **Breakpoint%**: capacidad de romper el saque rival
- **Clutch%**: rendimiento bajo presión (set point o diferencia ≤2)
- **Eficiencia de servicio**: (Aces - Errores) / Total saques

### 👕 Estadísticas por jugador
- Puntos, ataques, bloqueos, aces
- Errores de ataque y servicio
- Eficiencia de ataque y servicio
- Recepciones y defensas

### ✍️ Anotador manual
- Registro de puntos con un solo clic
- Acciones: ATAQUE, BLOQUEO, SAQUE, SAQUE MALO, ERROR
- Fundamentos: REC+, REC-, DEF+, DEF-
- Atajos de teclado para anotación rápida

### 📈 Análisis evolutivo
- Subí reportes HTML de partidos anteriores
- Compara Sideout%, Breakpoint%, Clutch% a lo largo del tiempo
- Detecta tendencias de mejora o empeoramiento

### 📄 Reportes descargables
- Reporte HTML con gráficos y estadísticas
- Se abre en cualquier navegador (sin internet)
- Se puede compartir por WhatsApp o mail

### 📱 Acceso remoto
- Vía túnel Cloudflare (URL fija)
- Funciona en PC y celular

### 🔄 Selector de partidos
- Cambia entre partidos históricos sin recargar la página
- Los datos se cargan automáticamente

### 📡 Modo offline
- Funciona sin conexión a internet
- Los datos se sincronizan al reconectar

---

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

El reporte incluye:

Marcador y estadísticas generales

Gráficos de evolución, momentum y rachas

Estadísticas individuales con recepción y defensa

Glosario de métricas con ejemplos prácticos

⚙️ Requisitos técnicos
Node.js 18.0.0 o superior

Navegador moderno (Chrome, Firefox, Edge)

Cloudflared (para acceso remoto)

Windows 10/11 (cliente SSH incluido)

📞 Contacto
Gonzalo
📱 1151364852

text

---

## 📝 **Resumen de cambios**

| Cambio  | Tipo                    |
| :---    | :---                    |
| Agregar recepción y defensa       | ➕ Nueva sección |
| Agregar Sideout/Breakpoint/Clutch | ➕ Nueva sección |
| Agregar Anotador manual           | ➕ Nueva sección |
| Agregar Quiebres                  | ➕ Nueva sección |
| Agregar selector de partidos      | ➕ Nueva sección |
| Agregar modo offline              | ➕ Nueva sección |
| Agregar requisitos técnicos       | ➕ Nueva sección |
| Mejorar descripción de reportes   | ✏️ Mejora         |
| Mejorar estructura                | ✏️ Mejora         |

---