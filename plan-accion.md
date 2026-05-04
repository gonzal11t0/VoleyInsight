# Plan de acción VoleyInsight

## Situación actual

- ✅ El sistema anda técnicamente
- ❌ Depende de tu PC + ngrok (frágil)
- ❌ No hay datos de prueba para mostrar siempre
- ❌ El modelo de negocio no está cerrado
- ⏳ Testeo real programado: 7 de mayo (ATTITUDE vs CEDEN)

---

## FASES

### FASE 0 - Preparación (HOY - 27 de Abril)

| Tarea                                                         | Por qué                                                       | Tiempo estimado |
|-------                                                        |---------                                                      |-----------------|
| Generar datos de prueba ficticios                             | Para poder mostrar el dashboard SIEMPRE, haya partido o no    | 30 min |
| Verificar que todas las métricas se calculen bien             | Usando el JSON de prueba                                      | 1 hora |
| Escribir guión para mostrar el sistema                        | Para no improvisar con el club                                | 30 min |
| Preparar notebook (limpiar escritorio, tener atajos a mano) | Para que sea profesional                                        | 15 min |

### FASE 1 - Testeo real (7 de mayo)

| Horario | Acción |
|---------|--------|
| 20:30 | Llegar al club (media hora antes) |
| 20:30 - 21:00 | Conectar notebook, abrir servidor + ngrok, probar que el link funcione |
| 21:00 - 21:05 | Mostrar al técnico el dashboard y el anotador (muy breve) |
| 21:00 - 20:00? | Partido: anotar puntos manualmente (usar atajos de teclado) |
| Post-partido | Generar reporte, mostrarlo, pedir feedback |

**Checklist para el día:**

- [ ] Notebook cargada
- [ ] Cargador
- [ ] Conexión a internet prevista (preguntar wifi del club, o usar datos del celular)
- [ ] Tener el matchId del partido (buscarlo antes en MetroVóley)
- [ ] Tener config.json actualizado
- [ ] Tener ngrok corriendo
- [ ] Tener el link del dashboard listo para compartir (por si alguien quiere ver desde el celular)

**Qué validar:**

- [ ] Que el tracker automático capture puntos (si MetroVóley tiene el partido)
- [ ] Que la anotación manual sea ágil (10-15 segundos por punto máximo)
- [ ] Que el dashboard se actualice sin errores
- [ ] Que el reporte se genere correctamente
- [ ] Anotar TODOS los problemas que surjan (no importa si son chicos)

### FASE 2 - Post-testeo (8 - 10 de mayo)

| Tarea | Prioridad |
|-------|-----------|
| Corregir errores encontrados | ALTA |
| Mejorar la experiencia de anotación (si fue lenta) | ALTA |
| Agregar algún feature que pidió el técnico | MEDIA |
| Preparar propuesta comercial con precio | ALTA |
| Mostrar el reporte al club y pedir feedback formal | ALTA |

### FASE 3 - Definición de precio

**Para pensar después del testeo:**

| Pregunta | Para definir |
|----------|--------------|
| ¿Cuánto está dispuesto a pagar un club de FMV? | Preguntar directamente |
| ¿Mensual o por partido? | Ver qué prefieren |
| ¿Descuento por varios equipos (inferiores)? | Para clubes grandes |
| ¿Precio de lanzamiento? | Para primeros clientes |

**Rangos sugeridos (provisorios):**

| Modalidad | Rango sugerido |
|-----------|----------------|
| Autogestión (mensual) | $30.000 - $70.000 ARS |
| Con operador (por partido) | $25.000 - $50.000 ARS |

### FASE 4 - Escalar (cuando tengas 1 o 2 clientes pagos)

| Acción | Por qué | Costo estimado |
|--------|---------|----------------|
| Migrar a servidor en la nube (Render o Railway) | Eliminar ngrok, tener uptime 24/7 | Gratis (plan gratuito) o ~$5-10 USD/mes |
| Comprar un dominio (voleyinsight.com.ar) | Profesional | ~$10 USD/año |
| Automatizar cambio de ID/nombres desde el dashboard | Que el club pueda cambiar de partido sin tocar JSON | 2-3 horas de desarrollo |

---

## PROPUESTA DE PRECIOS (borrador)

Después del testeo, podrías ofrecer algo así:

| Plan | Precio | Ideal para |
|------|--------|-------------|
| **Básico (autogestión)** | $40.000 ARS/mes | Club con alguien que anote |
| **Pro (con operador)** | $35.000 ARS/partido | Partidos importantes o finales |
| **Anual (autogestión)** | $400.000 ARS/año (2 meses gratis) | Club que usa el sistema toda la temporada |
| **Multiequipo** | $600.000 ARS/año | Club con 3+ categorías |

---

## PREGUNTAS PARA HACERLE AL TÉCNICO DESPUÉS DEL PARTIDO

1. ¿Entendiste las métricas? ¿Cuál te pareció más útil?
2. ¿El reporte te dio información que no tenías viendo el partido?
3. ¿Qué cambiarías o agregarías?
4. ¿Cuánto estarías dispuesto a pagar por esto por mes?
5. ¿Lo usarías solo para primera o también para inferiores?
6. ¿Te interesaría que analice al próximo rival (si está en MetroVóley)?

---

## RIESGOS Y CÓMO MITIGARLOS

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|-------------|
| Que el técnico no entienda las métricas | Media | Preparar una hoja con definiciones simples |
| Que la anotación sea lenta | Baja (ya tenés atajos) | Practicar antes con datos de prueba |
| Que ngrok falle durante el partido | Baja | Tener el dashboard corriendo en local (http://localhost:5500) como backup |
| Que la notebook se quede sin batería | Media | Llevar cargador y alargue |
| Que no haya internet en el club | Media | Usar datos del celular (tethering) |

---

## LO QUE NO HACER (por ahora)

- ❌ No ofrecer licencia perpetua
- ❌ No hacer freemium
- ❌ No gastar plata en servidor hasta tener un cliente pago
- ❌ No complicar el producto con features que nadie pidió

---

## PRÓXIMO HITO

**7 de mayo - Partido ATTITUDE vs CEDEN**

Objetivo: Salir de ahí con:
- Un reporte real generado
- Feedback del técnico
- Lista de problemas a corregir
- Idea clara de si esto se puede vender

---

## NOTAS PARA VOS

- No necesitás el producto perfecto para empezar a vender. Necesitás que resuelva un problema real.
- El club de tu hermana es tu mejor caso de éxito. Si a ellos les sirve, podés mostrarlo a otros.
- El precio se define probando. Preguntá "¿cuánto pagarías?" después de mostrar el valor, no antes.
- Si un club te dice "está caro", preguntá "¿cuánto te sale no tener estos datos?".