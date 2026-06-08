// PULSO by Gustar — Vercel Function
// api/index.js
// Recibe datos de Zapier, calcula puntajes, llama a Claude, genera HTML


// ── CONSTANTES ──
const PESOS = {
  'Enfoque estratégico': 0.15,
  'Equipo y personas': 0.12,
  'Cocina y producto': 0.12,
  'Servicio al cliente': 0.10,
  'Administración y finanzas': 0.15,
  'Compras e inventarios': 0.09,
  'Operación diaria': 0.13,
  'Marketing y ventas': 0.08,
  'Tecnología y sistemas': 0.06
};

const CRITICAS = [
  'Equipo y personas',
  'Cocina y producto',
  'Administración y finanzas',
  'Compras e inventarios',
  'Operación diaria'
];

const ORDEN_DESEMPATE = [
  'Administración y finanzas','Operación diaria','Cocina y producto',
  'Servicio al cliente','Compras e inventarios','Equipo y personas',
  'Enfoque estratégico','Marketing y ventas','Tecnología y sistemas'
];

const ORDEN_RADAR = [
  'Enfoque estratégico','Marketing y ventas','Servicio al cliente',
  'Cocina y producto','Compras e inventarios','Operación diaria',
  'Equipo y personas','Administración y finanzas','Tecnología y sistemas'
];

// ── HELPERS ──
const val = (r) => {
  if (!r) return 0;
  const s = r.toString().trim().toLowerCase();
  if (s === 'sí' || s === 'si') return 1;
  if (s === 'parcialmente') return 0.5;
  return 0;
};

const getEtiqueta = (p) => {
  if (p >= 86) return 'Fortaleza';
  if (p >= 71) return 'Avanzado';
  if (p >= 51) return 'En desarrollo';
  if (p >= 36) return 'Atención';
  if (p >= 21) return 'Riesgo';
  return 'Crítico';
};

const getNivelColor = (n) => {
  const colores = {
    0: { bg: '#FFEBEE', fg: '#B71C1C' },
    1: { bg: '#FFCDD2', fg: '#E53935' },
    2: { bg: '#FBE9E7', fg: '#D85A30' },
    3: { bg: '#EFEBE9', fg: '#4E342E' },
    4: { bg: '#E8F5E9', fg: '#2E7D32' },
    5: { bg: '#E8EAF6', fg: '#1A237E' }
  };
  return colores[n] || colores[2];
};

const getEtiquetaColor = (etiqueta) => {
  const colores = {
    'Fortaleza':     { bg: '#E8EAF6', fg: '#1A237E' },
    'Avanzado':      { bg: '#E8F5E9', fg: '#2E7D32' },
    'En desarrollo': { bg: '#EFEBE9', fg: '#4E342E' },
    'Atención':      { bg: '#FBE9E7', fg: '#D85A30' },
    'Riesgo':        { bg: '#FFCDD2', fg: '#E53935' },
    'Crítico':       { bg: '#FFEBEE', fg: '#B71C1C' }
  };
  return colores[etiqueta] || colores['Atención'];
};

// ── CÁLCULO DE PUNTAJES ──
function calcularPuntajes(body) {
  const dims = [
    { nombre: 'Enfoque estratégico',       critica: false, resps: [body.e1,body.e2,body.e3,body.e4,body.e5,body.e6] },
    { nombre: 'Equipo y personas',         critica: true,  resps: [body.q1,body.q2,body.q3,body.q4,body.q5,body.q6,body.q7] },
    { nombre: 'Cocina y producto',         critica: true,  resps: [body.c1,body.c2,body.c3,body.c4,body.c5,body.c6] },
    { nombre: 'Servicio al cliente',       critica: false, resps: [body.s1,body.s2,body.s3,body.s4,body.s5,body.s6] },
    { nombre: 'Administración y finanzas', critica: true,  resps: [body.f1,body.f2,body.f3,body.f4,body.f5,body.f6,body.f7] },
    { nombre: 'Compras e inventarios',     critica: true,  resps: [body.i1,body.i2,body.i3,body.i4,body.i5,body.i6,body.i7] },
    { nombre: 'Operación diaria',          critica: true,  resps: [body.o1,body.o2,body.o3,body.o4,body.o5,body.o6,body.o7] },
    { nombre: 'Marketing y ventas',        critica: false, resps: [body.m1,body.m2,body.m3,body.m4,body.m5,body.m6] },
    { nombre: 'Tecnología y sistemas',     critica: false, resps: [body.t1,body.t2,body.t3,body.t4,body.t5,body.t6] }
  ];

  let puntajeGeneral = 0;
  const resultados = dims.map(d => {
    const valores = d.resps.map(val);
    const suma = valores.reduce((a, b) => a + b, 0);
    const normalizado = Math.round((suma / d.resps.length) * 1000) / 10;
    puntajeGeneral += normalizado * PESOS[d.nombre];
    return {
      nombre: d.nombre,
      puntaje: normalizado,
      peso: PESOS[d.nombre],
      etiqueta: getEtiqueta(normalizado),
      es_critica: d.critica,
      alerta_menor_40: d.critica && normalizado < 40
    };
  });

  puntajeGeneral = Math.round(puntajeGeneral * 10) / 10;

  // Nivel
  let nivelNum = 0;
  if (puntajeGeneral > 85) nivelNum = 5;
  else if (puntajeGeneral > 70) nivelNum = 4;
  else if (puntajeGeneral > 50) nivelNum = 3;
  else if (puntajeGeneral > 35) nivelNum = 2;
  else if (puntajeGeneral > 20) nivelNum = 1;

  const nombresNivel = [
    'Sin estructura operativa','Primeros pasos operativos',
    'Operación en construcción','Operación estructurada',
    'Gestión basada en datos','Restaurante maduro y escalable'
  ];

  // Reglas de control
  let reglaControl = '';
  const criticas = resultados.filter(d => d.es_critica);
  if (nivelNum === 5) {
    const bajo = criticas.find(d => d.puntaje < 70);
    if (bajo) {
      nivelNum = 4;
      reglaControl = `Tu puntaje general alcanza el Nivel 5, pero ${bajo.nombre} (${bajo.puntaje}%) no cumple el umbral mínimo del 70%. Te clasificamos en Nivel 4 y esta dimensión es tu prioridad número uno.`;
    }
  }
  if (nivelNum === 4) {
    const bajo = criticas.find(d => d.puntaje < 55);
    if (bajo) {
      nivelNum = 3;
      reglaControl = `Tu puntaje general alcanza el Nivel 4, pero ${bajo.nombre} (${bajo.puntaje}%) no cumple el umbral mínimo del 55%. Te clasificamos en Nivel 3 y esta dimensión es tu prioridad número uno.`;
    }
  }

  // Priorización
  const finanzas = resultados.find(d => d.nombre === 'Administración y finanzas');
  let prioridad = '';
  if (finanzas.puntaje < 60) {
    prioridad = 'Administración y finanzas';
  } else {
    const criticas5 = resultados.filter(d => CRITICAS.includes(d.nombre));
    const minC = criticas5.reduce((a, b) => {
      if (Math.abs(a.puntaje - b.puntaje) <= 5)
        return ORDEN_DESEMPATE.indexOf(a.nombre) < ORDEN_DESEMPATE.indexOf(b.nombre) ? a : b;
      return a.puntaje < b.puntaje ? a : b;
    });
    if (minC.puntaje >= 60) {
      const crec = resultados.filter(d => ['Enfoque estratégico','Marketing y ventas','Tecnología y sistemas'].includes(d.nombre));
      prioridad = crec.reduce((a, b) => a.puntaje < b.puntaje ? a : b).nombre;
    } else {
      prioridad = minC.nombre;
    }
  }

  // Alerta especial
  const alertaEspecial = resultados.filter(d => d.alerta_menor_40).map(d => d.nombre).join(', ');

  // Escenario hallazgos
  const enRiesgoCritico = resultados.filter(d => d.puntaje <= 35);
  const escenario = enRiesgoCritico.length >= 3 ? 'A' : enRiesgoCritico.length === 2 ? 'B' : 'C';

  // Ordenamientos
  const dimsDesc = [...resultados].sort((a, b) => b.puntaje - a.puntaje);
  const dimsRadar = ORDEN_RADAR.map(n => resultados.find(d => d.nombre === n));

  // Contadores semáforo
  const contCriticoRiesgo = resultados.filter(d => d.puntaje <= 35).length;
  const contAtencion = resultados.filter(d => d.puntaje > 35 && d.puntaje <= 70).length;
  const contAvanzado = resultados.filter(d => d.puntaje > 70).length;

  const fecha = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  const diagId = 'PULSO-' + new Date().getFullYear() + '-' + Date.now().toString().slice(-6);

  return {
    diagnostico_id: diagId,
    fecha,
    empresario: {
      nombre: body.empresario || '',
      restaurante: body.restaurante || '',
      ciudad: body.ciudad || '',
      anos: body.anos || '',
      empleados: body.empleados || '',
      puntos_venta: body.puntos_venta || '',
      redes: body.redes || '',
      dolor_1: body.dolor_1 || '',
      dolor_2: body.dolor_2 || '',
      expectativa: body.expectativa || ''
    },
    calculos: {
      puntaje_general: puntajeGeneral,
      nivel_final: nivelNum,
      nombre_nivel_final: nombresNivel[nivelNum],
      regla_control: reglaControl,
      prioridad_principal: prioridad,
      alerta_especial: alertaEspecial,
      escenario_hallazgos: escenario,
      dimensiones: resultados,
      dimensiones_desc: dimsDesc,
      dimensiones_radar: dimsRadar,
      cont_critico_riesgo: contCriticoRiesgo,
      cont_atencion: contAtencion,
      cont_avanzado: contAvanzado
    }
  };
}

// ── GENERACIÓN DEL RADAR SVG ──
function generarRadarSVG(dimsRadar, nivelNum) {
  const W = 780, H = 700, cx = 390, cy = 330, r = 210;
  const n = 9;
  const angles = Array.from({ length: n }, (_, i) => i * 360 / n);

  const pt = (angleDeg, pct) => {
    const a = (angleDeg - 90) * Math.PI / 180;
    const rr = r * pct / 100;
    return { x: cx + rr * Math.cos(a), y: cy + rr * Math.sin(a) };
  };

  const ring = (pct) => dimsRadar.map((_, i) => {
    const p = pt(angles[i], pct);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');

  const polygon = dimsRadar.map((d, i) => {
    const p = pt(angles[i], d ? d.puntaje : 0);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');

  const nivelColores = {
    0: '#B71C1C', 1: '#E53935', 2: '#D85A30',
    3: '#4E342E', 4: '#2E7D32', 5: '#1A237E'
  };
  const areaColor = nivelColores[nivelNum] || '#D85A30';

  const iconos = {
    'Enfoque estratégico': '<path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503-6.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z"/>',
    'Marketing y ventas': '<path stroke-linecap="round" stroke-linejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 1 8.835-2.535"/>',
    'Servicio al cliente': '<path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"/>',
    'Cocina y producto': '<path stroke-linecap="round" stroke-linejoin="round" d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z"/>',
    'Compras e inventarios': '<path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"/>',
    'Operación diaria': '<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75"/>',
    'Equipo y personas': '<path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/>',
    'Administración y finanzas': '<path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/>',
    'Tecnología y sistemas': '<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18h3"/>'
  };

  const ICON = 16;
  const labels = dimsRadar.map((d, i) => {
    if (!d) return '';
    const angle = angles[i];
    const lx_raw = pt(angle, 128).x;
    const ly = pt(angle, 128).y;
    const angle_norm = angle % 360;
    let anchor = 'middle';
    let lx = lx_raw;
    if (lx_raw > cx + 15) { anchor = 'start'; lx = Math.min(lx_raw, W - 130); }
    else if (lx_raw < cx - 15) { anchor = 'end'; lx = Math.max(lx_raw, 130); }

    const color = d.puntaje < 36 ? '#B71C1C' : d.puntaje >= 71 ? '#2E7D32' : '#2C2C2A';
    const boldW = d.puntaje < 36 || d.puntaje >= 71 ? '700' : '400';
    const words = d.nombre.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length <= 14) cur = (cur + ' ' + w).trim();
      else { if (cur) lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);

    const totalH = ICON + 4 + lines.length * 12 + 12;
    const startY = ly - totalH / 2;
    const iconX = anchor === 'middle' ? lx - ICON/2 : anchor === 'start' ? lx : lx - ICON;

    const textLines = lines.map((line, j) =>
      `<text x="${lx.toFixed(1)}" y="${(startY + ICON + 4 + (j+1)*12).toFixed(1)}" text-anchor="${anchor}" font-size="9" font-family="Arial" fill="${color}" font-weight="${boldW}">${line}</text>`
    ).join('');

    const iconPath = iconos[d.nombre] || '';
    return `<g>
      <svg x="${iconX.toFixed(1)}" y="${startY.toFixed(1)}" width="${ICON}" height="${ICON}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8">${iconPath}</svg>
      ${textLines}
      <text x="${lx.toFixed(1)}" y="${(startY + ICON + 4 + lines.length*12 + 11).toFixed(1)}" text-anchor="${anchor}" font-size="9.5" font-family="Arial" fill="${color}" font-weight="700">${d.puntaje}%</text>
    </g>`;
  }).join('');

  const dots = dimsRadar.map((d, i) => {
    if (!d) return '';
    const p = pt(angles[i], d.puntaje);
    const col = d.puntaje < 36 ? '#B71C1C' : d.puntaje >= 71 ? '#2E7D32' : '#D85A30';
    return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="${col}" stroke="white" stroke-width="1.5"/>`;
  }).join('');

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs><filter id="sh"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.12"/></filter></defs>
  <rect width="${W}" height="${H}" fill="#FAFAF8" rx="10"/>
  <polygon points="${ring(100)}" fill="#F1EFE8" stroke="#DEDAD4" stroke-width="0.8"/>
  <polygon points="${ring(70)}" fill="#E8F5E9" stroke="none"/>
  <polygon points="${ring(50)}" fill="#F1EFE8" stroke="none"/>
  <polygon points="${ring(35)}" fill="#FFEBEE" stroke="none"/>
  <polygon points="${ring(70)}" fill="none" stroke="#2E7D32" stroke-width="1.3" stroke-dasharray="5,4"/>
  <polygon points="${ring(50)}" fill="none" stroke="#B45309" stroke-width="0.8" stroke-dasharray="3,3"/>
  <polygon points="${ring(35)}" fill="none" stroke="#B71C1C" stroke-width="1.3" stroke-dasharray="5,4"/>
  <polygon points="${ring(100)}" fill="none" stroke="#C8C6C0" stroke-width="0.8" stroke-dasharray="2,4"/>
  ${angles.map((a, i) => { const p = pt(a, 100); return `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="#D3D1C7" stroke-width="1"/>`; }).join('')}
  <polygon points="${polygon}" fill="${areaColor}" fill-opacity="0.20" stroke="${areaColor}" stroke-width="2.2" stroke-linejoin="round" filter="url(#sh)"/>
  <text x="${cx+5}" y="${(cy - r*0.35 + 4).toFixed(1)}" font-size="8" font-family="Arial" fill="#B71C1C" font-weight="700">35%</text>
  <text x="${cx+5}" y="${(cy - r*0.50 + 4).toFixed(1)}" font-size="8" font-family="Arial" fill="#B45309" font-weight="700">50%</text>
  <text x="${cx+5}" y="${(cy - r*0.70 + 4).toFixed(1)}" font-size="8" font-family="Arial" fill="#2E7D32" font-weight="700">70%</text>
  ${labels}
  ${dots}
  <rect x="50" y="${H-30}" width="14" height="3" rx="1" fill="#B71C1C"/>
  <text x="70" y="${H-22}" font-size="8.5" font-family="Arial" fill="#2C2C2A">35% Zona crítica</text>
  <rect x="210" y="${H-30}" width="14" height="3" rx="1" fill="#B45309"/>
  <text x="230" y="${H-22}" font-size="8.5" font-family="Arial" fill="#2C2C2A">50% Zona estable</text>
  <rect x="380" y="${H-30}" width="14" height="3" rx="1" fill="#2E7D32"/>
  <text x="400" y="${H-22}" font-size="8.5" font-family="Arial" fill="#2C2C2A">70% Zona avanzada</text>
</svg>`;
}

// ── GENERACIÓN DEL GANTT ──
function calcularGantt(acciones) {
  // Asignar semanas respetando precedencias y máximo 2 tareas simultáneas por responsable
  const plan = acciones.map((a, idx) => ({
    ...a,
    semanas_asignadas: a.semanas || [idx + 1]
  }));
  return plan;
}

// ── INYECCIÓN EN TEMPLATE ──
function generarHTML(template, diagnostico, textosClaude) {
  const { empresario, calculos } = diagnostico;
  const nivelColor = getNivelColor(calculos.nivel_final);

  // Tabla de dimensiones
  const filasTabla = calculos.dimensiones_desc.map(d => {
    const c = getEtiquetaColor(d.etiqueta);
    const alerta = d.alerta_menor_40 ? '⚠️' : d.es_critica ? '●' : '';
    return `<tr>
      <td>${d.nombre}</td>
      <td class="tc"><span style="font-weight:700;color:${c.fg}">${d.puntaje}%</span></td>
      <td class="tc"><span class="etiqueta" style="background:${c.bg};color:${c.fg}">${d.etiqueta}</span></td>
      <td class="tc">${alerta}</td>
    </tr>`;
  }).join('');

  // Semáforo
  const filasSemaforo = calculos.dimensiones_desc.map(d => {
    const c = getEtiquetaColor(d.etiqueta);
    return `<tr>
      <td class="tc"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${c.fg};vertical-align:middle;margin-right:6px;"></span></td>
      <td>${d.nombre}${d.alerta_menor_40 ? ' ⚠️' : ''}</td>
      <td class="tc" style="font-weight:700;color:${c.fg}">${d.puntaje}%</td>
      <td class="tc"><span class="etiqueta" style="background:${c.bg};color:${c.fg}">${d.etiqueta}</span></td>
    </tr>`;
  }).join('');

  // Hallazgos
  const hallazgosHTML = (textosClaude.hallazgos || []).map(h => {
    const esCritico = h.tipo === 'critico';
    const headerBg = esCritico ? '#B71C1C' : '#2E7D32';
    const bodyBg = esCritico ? '#FFEBEE' : '#E8F5E9';
    const impactoColor = esCritico ? '#B71C1C' : '#2E7D32';
    const icono = esCritico ? '🔴' : '🟢';
    const tipoLabel = esCritico ? 'Crítico' : 'Oportunidad';
    const impactoLabel = esCritico ? 'Impacto' : 'Oportunidad';
    return `<div class="hallazgo" style="border-radius:6px;overflow:hidden;margin-bottom:14px;">
      <div style="background:${headerBg};padding:10px 16px;display:flex;align-items:flex-start;gap:10px;">
        <span style="font-size:16pt">${icono}</span>
        <div>
          <div style="font-size:8pt;font-weight:700;color:rgba(255,255,255,0.85);text-transform:uppercase;">${tipoLabel} · ${h.dimension} (${h.puntaje || ''}%)</div>
          <div style="font-size:10.5pt;font-weight:700;color:white;margin-top:3px;">"${h.titulo}"</div>
        </div>
      </div>
      <div style="background:${bodyBg};padding:12px 16px 14px;">
        <div style="font-size:9.5pt;line-height:1.65;margin-bottom:10px;">${h.descripcion}</div>
        <div style="font-size:9.5pt;font-weight:600;padding:8px 12px;border-radius:4px;background:rgba(0,0,0,0.06);color:${impactoColor}"><strong>${impactoLabel}:</strong> ${h.impacto}</div>
      </div>
    </div>`;
  }).join('');

  // Gantt
  const accionesGantt = textosClaude.acciones || [];
  const tiposColor = {
    'victoria': '#1565C0', 'critica': '#B71C1C',
    'depende': '#B45309', 'estructural': '#D85A30', 'normal': '#2C2C2A'
  };
  const filasGantt = accionesGantt.map((a, idx) => {
    const bg = idx % 2 === 0 ? 'white' : '#FAFAF8';
    const barras = Array.from({ length: 12 }, (_, i) => {
      const sem = i + 1;
      const activo = (a.semanas || []).includes(sem);
      const barColor = tiposColor[a.tipo] || '#2C2C2A';
      return `<td style="text-align:center;padding:3px 1px;border-bottom:1px solid #E5E4DF;">
        ${activo ? `<span style="display:block;width:88%;margin:0 auto;height:16px;border-radius:3px;background:${barColor};"></span>` : ''}
      </td>`;
    }).join('');
    return `<tr style="background:${bg}">
      <td style="padding:5px 7px;border-bottom:1px solid #E5E4DF;font-size:8pt;">
        <strong style="color:#D85A30">${a.num}.</strong> ${a.accion}
        ${a.depende_de ? `<div style="font-size:7pt;color:#888;font-style:italic">Depende de A${a.depende_de}</div>` : ''}
      </td>
      <td style="padding:5px 7px;border-bottom:1px solid #E5E4DF;font-size:7.5pt;color:#888;font-style:italic">${a.recurso || ''}</td>
      <td style="padding:5px 7px;border-bottom:1px solid #E5E4DF;font-size:7.5pt;color:#888;font-style:italic">${a.entregable || ''}</td>
      ${barras}
      <td style="padding:5px 7px;border-bottom:1px solid #E5E4DF;font-size:8pt;font-weight:700;color:#D85A30;text-align:center">${(a.semanas || []).length} sem.</td>
    </tr>`;
  }).join('');

  // Reemplazar variables en el template
  let html = template;
  const replacements = {
    '{{NOMBRE_RESTAURANTE}}': empresario.restaurante,
    '{{NOMBRE_EMPRESARIO}}': empresario.nombre,
    '{{CIUDAD}}': empresario.ciudad,
    '{{FECHA}}': diagnostico.fecha,
    '{{ANOS_OPERACION}}': empresario.anos,
    '{{NUM_EMPLEADOS}}': empresario.empleados,
    '{{PUNTOS_VENTA}}': empresario.puntos_venta,
    '{{DOLOR_1}}': empresario.dolor_1,
    '{{DOLOR_2}}': empresario.dolor_2,
    '{{EXPECTATIVA}}': empresario.expectativa,
    '{{NIVEL_NUM}}': calculos.nivel_final,
    '{{NIVEL_NOMBRE}}': calculos.nombre_nivel_final,
    '{{PUNTAJE_GENERAL}}': calculos.puntaje_general,
    '{{NIVEL_BG}}': nivelColor.bg,
    '{{NIVEL_FG}}': nivelColor.fg,
    '{{FRASE_APERTURA}}': textosClaude.frase_apertura || '',
    '{{DESCRIPCION_NIVEL}}': textosClaude.descripcion_nivel || '',
    '{{RESUMEN_EJECUTIVO}}': textosClaude.resumen_ejecutivo || '',
    '{{NARRATIVA_DOLORES}}': textosClaude.narrativa_dolores || '',
    '{{PRIORIDAD_INMEDIATA}}': textosClaude.prioridad_inmediata || '',
    '{{TABLA_DIMENSIONES}}': filasTabla,
    '{{RADAR_SVG}}': generarRadarSVG(calculos.dimensiones_radar, calculos.nivel_final),
    '{{FRASE_RADAR}}': textosClaude.frase_radar || '',
    '{{HALLAZGOS}}': hallazgosHTML,
    '{{ESCENARIO_HALLAZGOS}}': `Escenario ${calculos.escenario_hallazgos}`,
    '{{TABLA_SEMAFORO}}': filasSemaforo,
    '{{CONTADOR_CRITICO_RIESGO}}': `🔴 ${calculos.cont_critico_riesgo} en Crítico/Riesgo`,
    '{{CONTADOR_ATENCION}}': `🟠 ${calculos.cont_atencion} en Atención`,
    '{{CONTADOR_AVANZADO_FORTALEZA}}': `🟢 ${calculos.cont_avanzado} Avanzado/Fortaleza`,
    '{{FRASE_SEMAFORO}}': textosClaude.frase_semaforo || '',
    '{{TABLA_GANTT}}': filasGantt,
    '{{DURACION_TOTAL}}': textosClaude.duracion_plan || '10 a 12 semanas',
    '{{MENSAJE_CIERRE_PLAN}}': `${empresario.restaurante} tendrá sus bases operativas transformadas.`,
    '{{ACCION_SEMANA}}': textosClaude.accion_semana || '',
    '{{PRIMER_PASO}}': textosClaude.primer_paso || '',
    '{{TEXTO_ACOMPANAMIENTO}}': textosClaude.texto_acompanamiento || '',
    '{{CTA_ACOMPANAMIENTO}}': 'Si quieres saber más sobre el programa de acompañamiento, responde este mensaje o agenda una llamada de 20 minutos. Sin compromiso.',
    '{{NOMBRE_SONIA}}': 'Sonia Montes',
    '{{ALERTA_CONTROL}}': calculos.regla_control ? `<div style="background:#FEF3C7;border-left:4px solid #B45309;padding:12px 16px;border-radius:4px;margin-bottom:12px;font-size:10pt;">${calculos.regla_control}</div>` : '',
    '{{SEM_1_NUM}}': '2', '{{SEM_1_CLASE}}': 'sem-ok',
    '{{SEM_2_NUM}}': '2', '{{SEM_2_CLASE}}': 'sem-ok',
    '{{SEM_3_NUM}}': '2', '{{SEM_3_CLASE}}': 'sem-ok',
    '{{SEM_4_NUM}}': '2', '{{SEM_4_CLASE}}': 'sem-ok',
    '{{SEM_5_NUM}}': '2', '{{SEM_5_CLASE}}': 'sem-ok',
    '{{SEM_6_NUM}}': '2', '{{SEM_6_CLASE}}': 'sem-ok',
    '{{SEM_7_NUM}}': '2', '{{SEM_7_CLASE}}': 'sem-ok',
    '{{SEM_8_NUM}}': '2', '{{SEM_8_CLASE}}': 'sem-ok',
    '{{SEM_9_NUM}}': '1', '{{SEM_9_CLASE}}': 'sem-ok',
    '{{SEM_10_NUM}}': '1', '{{SEM_10_CLASE}}': 'sem-ok',
    '{{SEM_11_NUM}}': '1', '{{SEM_11_CLASE}}': 'sem-ok',
    '{{SEM_12_NUM}}': '1', '{{SEM_12_CLASE}}': 'sem-ok',
  };

  for (const [key, value] of Object.entries(replacements)) {
    html = html.replaceAll(key, String(value));
  }

  return html;
}

// ── LLAMADA A CLAUDE ──
async function llamarClaude(apiKey, promptMaestro, diagnostico) {
  const userMessage = `Genera los textos consultivos para el informe PULSO del siguiente diagnóstico.

REGLAS OBLIGATORIAS:
- Usa los datos del JSON como fuente de verdad absoluta.
- No recalcules puntajes.
- No devuelvas HTML.
- No devuelvas markdown.
- No uses bloques de código.
- Devuelve únicamente un objeto JSON válido.
- Todos los valores deben ser strings, números, arrays u objetos JSON válidos.
- No uses saltos de línea dentro de strings; usa espacios.
- No uses comillas dobles dentro de los textos; si necesitas citar algo, usa comillas simples.
- No cierres la respuesta hasta completar todo el JSON.
- El campo acciones debe traer máximo 10 acciones.
- El campo hallazgos debe traer máximo 4 hallazgos.
- Las semanas de cada acción deben ser números entre 1 y 12.

ESTRUCTURA EXACTA DE SALIDA:
{
  "frase_apertura": "string",
  "descripcion_nivel": "string",
  "resumen_ejecutivo": "string",
  "narrativa_dolores": "string",
  "prioridad_inmediata": "string",
  "frase_radar": "string",
  "hallazgos": [
    {
      "tipo": "critico|oportunidad",
      "dimension": "string",
      "puntaje": 0,
      "titulo": "string",
      "descripcion": "string",
      "impacto": "string"
    }
  ],
  "frase_semaforo": "string",
  "acciones": [
    {
      "num": 1,
      "dimension": "string",
      "accion": "string",
      "recurso": "string",
      "tiempo": "string",
      "entregable": "string",
      "tipo": "victoria|critica|depende|estructural|normal",
      "semanas": [1],
      "depende_de": null
    }
  ],
  "duracion_plan": "string",
  "accion_semana": "string",
  "primer_paso": "string",
  "texto_acompanamiento": "string"
}

LÍMITES DE EXTENSIÓN:
- frase_apertura: máximo 90 palabras.
- descripcion_nivel: máximo 80 palabras.
- resumen_ejecutivo: máximo 90 palabras.
- narrativa_dolores: máximo 90 palabras.
- prioridad_inmediata: máximo 45 palabras.
- frase_radar: máximo 45 palabras.
- frase_semaforo: máximo 45 palabras.
- cada descripcion de hallazgo: máximo 70 palabras.
- cada accion: máximo 20 palabras.
- accion_semana: máximo 70 palabras.
- primer_paso: máximo 35 palabras.
- texto_acompanamiento: usa exactamente este texto adaptando el nombre del restaurante: Este diagnóstico te muestra dónde está [Nombre del restaurante] hoy. Pero saber dónde estás es solo el primer paso — el trabajo real está en la implementación. Si quieres que te acompañe semana a semana en ese proceso, con orientación concreta sobre qué hacer, cómo hacerlo y cómo medir que está funcionando, tengo un programa diseñado exactamente para eso.

JSON del diagnóstico:
${JSON.stringify(diagnostico)}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      max_tokens: 8000,
      temperature: 0.1,
      system: promptMaestro,
      messages: [{ role: 'user', content: userMessage }]
    })
  });

  const rawResponse = await response.text();

  if (!response.ok) {
    throw new Error(`Claude API error ${response.status}: ${rawResponse}`);
  }

  let data;
  try {
    data = JSON.parse(rawResponse);
  } catch (err) {
    throw new Error('Claude API devolvió una respuesta no JSON: ' + rawResponse.slice(0, 1000));
  }

  const texto = data.content?.[0]?.text?.trim();

  if (!texto) {
    throw new Error('Claude devolvió una respuesta vacía o sin content[0].text');
  }

  // Limpiar markdown si Claude lo añadió
  const clean = texto
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(clean);
  } catch (err) {
    console.error('Claude raw output:', texto);
    console.error('Claude clean output:', clean);
    throw new Error('Claude no devolvió JSON válido: ' + clean.slice(0, 1200));
  }
}

// ── HANDLER PRINCIPAL ──
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Normalizar claves a minúsculas para manejar variaciones de Zapier
    const rawBody = req.body;
    const body = {};
    for (const [key, value] of Object.entries(rawBody)) {
      body[key.toLowerCase()] = value;
    }
    // Mapear variaciones comunes de nombres de campos
    if (!body.empresario && body['first name']) body.empresario = body['first name'];
    if (!body.empresario && body['nombre']) body.empresario = body['nombre'];
    if (!body.restaurante && body['restaurante']) body.restaurante = body['restaurante'];

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: 'ANTHROPIC_API_KEY no configurada en Vercel'
      });
    }

    if (!apiKey.startsWith('sk-ant-')) {
      return res.status(500).json({
        ok: false,
        error: 'ANTHROPIC_API_KEY tiene formato inválido. Debe empezar por sk-ant-'
      });
    }

    // Leer archivos desde GitHub
    const GITHUB_RAW = 'https://raw.githubusercontent.com/gustargestion/pulso-gustar/main';
    const [promptRes, templateRes] = await Promise.all([
      fetch(GITHUB_RAW + '/prompt_maestro.txt'),
      fetch(GITHUB_RAW + '/template.html')
    ]);

    if (!promptRes.ok) {
      return res.status(500).json({
        ok: false,
        error: 'No se pudo cargar prompt_maestro.txt desde GitHub',
        status: promptRes.status
      });
    }

    if (!templateRes.ok) {
      return res.status(500).json({
        ok: false,
        error: 'No se pudo cargar template.html desde GitHub',
        status: templateRes.status
      });
    }

    const promptMaestro = await promptRes.text();
    const template = await templateRes.text();

    // 1. Calcular puntajes (determinístico)
    const diagnostico = calcularPuntajes(body);

    // 2. Llamar a Claude solo para redacción
    const textosClaude = await llamarClaude(apiKey, promptMaestro, diagnostico);

    // 3. Generar HTML inyectando textos en el template
    const htmlFinal = generarHTML(template, diagnostico, textosClaude);

    // 4. Validar HTML
    const esValido = htmlFinal.includes('<!DOCTYPE html') && htmlFinal.includes('</html>');
    if (!esValido) {
      return res.status(500).json({ error: 'HTML generado inválido' });
    }

    // 5. Devolver resultado
    return res.status(200).json({
      ok: true,
      diagnostico_id: diagnostico.diagnostico_id,
      restaurante: diagnostico.empresario.restaurante,
      empresario: diagnostico.empresario.nombre,
      puntaje_general: diagnostico.calculos.puntaje_general,
      nivel: diagnostico.calculos.nivel_final,
      nombre_nivel: diagnostico.calculos.nombre_nivel_final,
      html_informe: htmlFinal,
      tokens_claude: 4000
    });

  } catch (err) {
    console.error('Error PULSO:', err);
    return res.status(500).json({ error: err.message });
  }
}
