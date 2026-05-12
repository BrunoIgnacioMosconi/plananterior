// Función para mostrar mensajes y permitir deshacer la última eliminación de alimento
// Pila para guardar eliminaciones múltiples
let gruposEliminadosStack = [];
let eliminadosStack = [];
function mostrarMensajeRestaurar(mensaje, grupoKey, valor, idx) {
  let msgContainer = document.getElementById('mensaje-container');
  if (!msgContainer) {
    msgContainer = document.createElement('div');
    msgContainer.id = 'mensaje-container';
    msgContainer.className = 'mensaje-container';
    document.body.appendChild(msgContainer);
  }

  // Guardar en la pila de eliminados
  eliminadosStack.push({ grupoKey, valor, idx });

  const msgElement = document.createElement('div');
  msgElement.className = 'mensaje info';
  msgElement.innerHTML = `<div class="mensaje-contenido"><span class="mensaje-icono">ℹ️</span> ${mensaje}</div>`;

  // Botón de cerrar con restaurar
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.className = 'mensaje-cerrar';
  closeBtn.onclick = () => {
    // Restaurar el alimento eliminado (último de la pila)
    const ultimo = eliminadosStack.pop();
    if (ultimo) {
      const current = getOpciones();
      if (!Array.isArray(current[ultimo.grupoKey])) current[ultimo.grupoKey] = [];
      current[ultimo.grupoKey].splice(ultimo.idx, 0, ultimo.valor);
      setOpciones(current);
      renderOpcionesForm();
      cargarComidas();
    }
    msgContainer.removeChild(msgElement);
  };
  msgElement.querySelector('.mensaje-contenido').appendChild(closeBtn);

  msgContainer.appendChild(msgElement);
  setTimeout(() => msgElement.classList.add('visible'), 10);
  setTimeout(() => {
    if (msgElement.parentNode) {
      msgElement.classList.remove('visible');
      setTimeout(() => {
        if (msgElement.parentNode) {
          msgElement.parentNode.removeChild(msgElement);
        }
      }, 300);
    }
  }, 6000);
}
// — Exportar historial a CSV —
function exportarHistorialCSV() {
   const historial = JSON.parse(localStorage.getItem('historialComidas') || '[]');
  const waterCounts = JSON.parse(localStorage.getItem('waterCounts') || '{}');
  const jugoCounts = JSON.parse(localStorage.getItem('jugoCounts') || '{}');
  const suplementosPorDia = JSON.parse(localStorage.getItem('suplementosPorDia') || '{}');
  const eventualidades = JSON.parse(localStorage.getItem('eventualidadesSemanales') || '[]');
  const dias = {};
  historial.forEach(item => {
    const fechaSolo = item.fecha.split(',')[0].split(' ')[0].trim();
    if (!dias[fechaSolo]) dias[fechaSolo] = [];
    dias[fechaSolo].push(item);
  });
  // Incluir días con solo agua, jugo o suplementos para que el round-trip no los pierda.
  [waterCounts, jugoCounts, suplementosPorDia].forEach(obj => {
    Object.keys(obj).forEach(fecha => {
      if (!dias[fecha]) dias[fecha] = [{ nombre: '', seleccion: '' }];
    });
  });
  let csv = 'Fecha,Agua,Jugo,Suplementos,Comida,Selección\n';
  Object.keys(dias).sort((a, b) => {
    const [da, ma, ya] = a.split('/');
    const [db, mb, yb] = b.split('/');
    return new Date(`${yb}-${mb}-${db}`) - new Date(`${ya}-${ma}-${da}`);
  }).forEach(fecha => {
    const agua = waterCounts[fecha] || 0;
    const jugo = jugoCounts[fecha] || 0;
    const suplementos = (suplementosPorDia[fecha] || []).join(' | ');
    dias[fecha].forEach(item => {
      const fechaCSV = `"${fecha.replace(/"/g, '""')}"`;
      const aguaCSV = `"${agua}"`;
      const jugoCSV = `"${jugo}"`;
      const suplementosCSV = `"${suplementos.replace(/"/g, '""')}"`;
      const nombre = `"${(item.nombre || '').replace(/"/g, '""')}"`;
      const seleccion = `"${(item.seleccion || '').replace(/"/g, '""')}"`;
      csv += `${fechaCSV},${aguaCSV},${jugoCSV},${suplementosCSV},${nombre},${seleccion}\n`;
    });
  });

  // Agregar eventualidades en su propia sección
  csv += '\nEventualidades\n';
  eventualidades.forEach(e => {
    const fechaCSV = `"${(e.fecha || '').replace(/"/g, '""')}"`;
    const tipoCSV = `"${(e.tipo || '').replace(/"/g, '""')}"`;
    const tsCSV = `"${e.ts || ''}"`;
    csv += `${fechaCSV},${tipoCSV},${tsCSV}\n`;
  });

  // Agregar las opciones de dropdowns al final del CSV
  csv += '\nOpciones de Dropdowns\n';
  const opcionesDropdowns = JSON.parse(localStorage.getItem('opcionesDropdowns') || 'null') || opciones;
  // Exportar todos los grupos definidos en opciones, incluyendo los nuevos dropdowns
  Object.keys(opciones).forEach(grupo => {
    const valores = opcionesDropdowns[grupo] || [];
    csv += `"${grupo}","${valores.join(' | ')}"\n`;
  });

  // Agregar la configuración de grupos por comida
  csv += '\nConfiguración de Comidas - Entrenamiento\n';
  const comidasEntrenamientoSaved = JSON.parse(localStorage.getItem('comidasEntrenamiento') || 'null') || comidasEntrenamiento;
  comidasEntrenamientoSaved.forEach(comida => {
    csv += `"${comida.nombre}","${comida.grupos.join(' | ')}"\n`;
  });

  csv += '\nConfiguración de Comidas - Sin Entrenamiento\n';
  const comidasNoEntrenamientoSaved = JSON.parse(localStorage.getItem('comidasNoEntrenamiento') || 'null') || comidasNoEntrenamiento;
  comidasNoEntrenamientoSaved.forEach(comida => {
    csv += `"${comida.nombre}","${comida.grupos.join(' | ')}"\n`;
  });

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'historial_comidas.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// — Importar historial desde CSV —
function importarHistorialCSV(file) {

  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result.replace(/^\u0000?(\uFEFF)?/, '');
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      alert('El archivo CSV está vacío o no tiene datos.');
      return;
    }
    // Separar historial y otras secciones
    let eventualidadesStart = lines.findIndex(l => l.toLowerCase().trim() === 'eventualidades');
    let opcionesStart = lines.findIndex(l => l.toLowerCase().includes('opciones de dropdowns'));
    // El historial termina antes de cualquier sección posterior
    const firstSectionStart = [eventualidadesStart, opcionesStart].filter(x => x > -1).sort((a, b) => a - b)[0] ?? lines.length;
    let historialLines = lines.slice(0, firstSectionStart);

    let eventualidadesLines = [];
    if (eventualidadesStart > -1) {
      const endIdx = lines.findIndex((l, i) => i > eventualidadesStart && (l.toLowerCase().includes('opciones de dropdowns') || l.toLowerCase().includes('configuración de comidas')));
      eventualidadesLines = lines.slice(eventualidadesStart + 1, endIdx > -1 ? endIdx : lines.length).filter(l => l.trim() && l.includes(','));
    }

    let opcionesLines = opcionesStart > -1 ? lines.slice(opcionesStart + 1) : [];

    // Buscar secciones de configuración de comidas
    let entrenamientoStart = lines.findIndex(l => l.toLowerCase().includes('configuración de comidas - entrenamiento'));
    let noEntrenamientoStart = lines.findIndex(l => l.toLowerCase().includes('configuración de comidas - sin entrenamiento'));

    // Extraer líneas de cada sección correctamente
    let entrenamientoLines = [];
    let noEntrenamientoLines = [];

    if (entrenamientoStart > -1) {
      // Buscar el final de la sección de entrenamiento
      const finEntrenamiento = noEntrenamientoStart > -1 ? noEntrenamientoStart :
                              lines.findIndex((l, i) => i > entrenamientoStart && l.trim() === '');

      const endIdx = finEntrenamiento > -1 ? finEntrenamiento : lines.length;
      entrenamientoLines = lines.slice(entrenamientoStart + 1, endIdx).filter(l => l.trim() && l.includes(','));
    }

    if (noEntrenamientoStart > -1) {
      // Buscar el final de la sección de no entrenamiento
      const finNoEntrenamiento = lines.findIndex((l, i) => i > noEntrenamientoStart && l.trim() === '');

      const endIdx = finNoEntrenamiento > -1 ? finNoEntrenamiento : lines.length;
      noEntrenamientoLines = lines.slice(noEntrenamientoStart + 1, endIdx).filter(l => l.trim() && l.includes(','));
    }

    // Procesar historial
    const headers = historialLines[0].split(',');
    const idxFecha = headers.findIndex(h => h.toLowerCase().includes('fecha'));
    const idxAgua = headers.findIndex(h => h.toLowerCase().includes('agua'));
    const idxJugo = headers.findIndex(h => h.toLowerCase().includes('jugo'));
    const idxSup = headers.findIndex(h => h.toLowerCase().includes('suplementos'));
    const idxComida = headers.findIndex(h => h.toLowerCase().includes('comida'));
    const idxSel = headers.findIndex(h => h.toLowerCase().includes('selección'));
    if (idxFecha < 0 || idxComida < 0 || idxSel < 0) {
      alert('CSV en formato inesperado.');
      return;
    }
    const waterCounts = {};
    const jugoCounts = {};
    const suplementosPorDia = {};
    const historial = [];
    for (let i = 1; i < historialLines.length; i++) {
      const cols = historialLines[i].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      const fecha = (cols[idxFecha] || '').replace(/(^"|"$)/g, '').trim();
      const agua = (cols[idxAgua] || '').replace(/(^"|"$)/g, '').trim();
      const jugo = idxJugo >= 0 ? (cols[idxJugo] || '').replace(/(^"|"$)/g, '').trim() : '';
      const sup = (cols[idxSup] || '').replace(/(^"|"$)/g, '').trim();
      const nombre = (cols[idxComida] || '').replace(/(^"|"$)/g, '').trim();
      const seleccion = (cols[idxSel] || '').replace(/(^"|"$)/g, '').trim();
      if (fecha) {
        if (agua) waterCounts[fecha] = parseInt(agua, 10) || 0;
        if (jugo) jugoCounts[fecha] = parseInt(jugo, 10) || 0;
        if (sup) suplementosPorDia[fecha] = sup.split(' | ').map(s => s.trim());
      }
      if (fecha && nombre) {
        historial.push({ fecha, nombre, seleccion });
      }
    }
    localStorage.setItem('waterCounts', JSON.stringify(waterCounts));
    localStorage.setItem('jugoCounts', JSON.stringify(jugoCounts));
    localStorage.setItem('suplementosPorDia', JSON.stringify(suplementosPorDia));
    localStorage.setItem('historialComidas', JSON.stringify(historial));

    // Procesar eventualidades
    if (eventualidadesLines.length) {
      const eventualidades = eventualidadesLines.map(line => {
        const parts = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
        const fecha = (parts[0] || '').replace(/(^"|"$)/g, '').trim();
        const tipo = (parts[1] || '').replace(/(^"|"$)/g, '').trim();
        const ts = parseInt((parts[2] || '').replace(/(^"|"$)/g, '').trim(), 10) || Date.now();
        return fecha && tipo ? { fecha, tipo, ts } : null;
      }).filter(Boolean);
      localStorage.setItem('eventualidadesSemanales', JSON.stringify(eventualidades));
    }

    // Procesar opciones de dropdowns
    if (opcionesLines.length) {
      const opcionesDropdowns = {};
      opcionesLines.forEach(line => {
        const parts = line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
        if (parts.length >= 2) {
          const grupo = (parts[0]||'').replace(/(^\"|\"$)/g, '').trim();
          const valores = (parts[1]||'').replace(/(^\"|\"$)/g, '').split(' | ').map(s=>s.trim()).filter(Boolean);
          if (grupo) opcionesDropdowns[grupo] = valores;
        }
      });
      // Asegurar que todos los grupos de opciones existan, aunque estén vacíos
      Object.keys(opciones).forEach(grupo => {
        if (!opcionesDropdowns.hasOwnProperty(grupo)) {
          opcionesDropdowns[grupo] = [];
        }
      });
      localStorage.setItem('opcionesDropdowns', JSON.stringify(opcionesDropdowns));
      renderOpcionesForm();
      cargarComidas();
    }

    // Procesar configuración de comidas
    // Para días de entrenamiento
    if (entrenamientoLines.length) {
      // Crear una copia de la configuración original como referencia
      const configOriginal = JSON.parse(JSON.stringify(comidasEntrenamiento));

      // Mapear las líneas a objetos de comida
      const nuevasComidasEntrenamiento = entrenamientoLines.map(line => {
        const parts = line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
        if (parts.length >= 2) {
          const nombre = (parts[0]||'').replace(/(^\"|\"$)/g, '').trim();
          const grupos = (parts[1]||'').replace(/(^\"|\"$)/g, '').split(' | ').map(s=>s.trim()).filter(Boolean);

          // Buscar el tipo correspondiente en la configuración original
          const comidaOriginal = configOriginal.find(c => c.nombre === nombre);
          const tipo = comidaOriginal ? comidaOriginal.tipo : null;

          return { nombre, tipo, grupos };
        }
        return null;
      }).filter(Boolean); // Eliminar cualquier null

      if (nuevasComidasEntrenamiento.length) {
        localStorage.setItem('comidasEntrenamiento', JSON.stringify(nuevasComidasEntrenamiento));

        // Actualizar la referencia en memoria
        comidasEntrenamiento.length = 0; // Vaciar el array
        nuevasComidasEntrenamiento.forEach(c => comidasEntrenamiento.push(c));
      }
    }

    // Para días sin entrenamiento
    if (noEntrenamientoLines.length) {
      // Crear una copia de la configuración original como referencia
      const configOriginal = JSON.parse(JSON.stringify(comidasNoEntrenamiento));

      // Mapear las líneas a objetos de comida
      const nuevasComidasNoEntrenamiento = noEntrenamientoLines.map(line => {
        const parts = line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
        if (parts.length >= 2) {
          const nombre = (parts[0]||'').replace(/(^\"|\"$)/g, '').trim();
          const grupos = (parts[1]||'').replace(/(^\"|\"$)/g, '').split(' | ').map(s=>s.trim()).filter(Boolean);

          // Buscar el tipo correspondiente en la configuración original
          const comidaOriginal = configOriginal.find(c => c.nombre === nombre);
          const tipo = comidaOriginal ? comidaOriginal.tipo : null;

          return { nombre, tipo, grupos };
        }
        return null;
      }).filter(Boolean); // Eliminar cualquier null

      if (nuevasComidasNoEntrenamiento.length) {
        localStorage.setItem('comidasNoEntrenamiento', JSON.stringify(nuevasComidasNoEntrenamiento));

        // Actualizar la referencia en memoria
        comidasNoEntrenamiento.length = 0; // Vaciar el array
        nuevasComidasNoEntrenamiento.forEach(c => comidasNoEntrenamiento.push(c));
      }
    }

    // Recargar todos los datos necesarios
    cargarComidas();
    cargarHistorial();
    cargarEventualidades();
    cargarSuplementosDia();

    // Refrescar los contadores de agua y jugo del día actual
    const todayKey = getTodayKey();
    const waterSpan = document.getElementById('water-count');
    if (waterSpan) waterSpan.textContent = getWaterCount(todayKey);
    const jugoSpan = document.getElementById('jugo-count');
    if (jugoSpan) jugoSpan.textContent = getJugoCount(todayKey);

    // Forzar la actualización de la configuración de dropdowns por comida
    // independientemente de la pestaña actual
    renderOpcionesForm();

  };
  reader.readAsText(file, 'UTF-8');
}

// Función para cargar la configuración de comidas desde localStorage
function cargarConfiguracionComidas() {
  // Cargar configuración para días de entrenamiento
  const entrenamientoSaved = JSON.parse(localStorage.getItem('comidasEntrenamiento')) || [];
  if (entrenamientoSaved.length > 0) {
    // Vaciar el array existente y llenarlo con nuevos valores
    comidasEntrenamiento.length = 0;
    entrenamientoSaved.forEach(item => comidasEntrenamiento.push(item));
  }

  // Cargar configuración para días sin entrenamiento
  const noEntrenamientoSaved = JSON.parse(localStorage.getItem('comidasNoEntrenamiento')) || [];
  if (noEntrenamientoSaved.length > 0) {
    // Vaciar el array existente y llenarlo con nuevos valores
    comidasNoEntrenamiento.length = 0;
    noEntrenamientoSaved.forEach(item => comidasNoEntrenamiento.push(item));
  }
}

// — Datos y lógica core de la app —

// Variable global para seguir la pestaña activa
let tabActual = 'principal';

// 🧠 Aquí están todas las opciones para los dropdowns agrupadas por tipo
const opciones = {
  proteinas_desayuno_merienda: [
    "Vaso de leche (200cc)",
    "Vaso de yogur (200cc)",
    "Porción de queso (70gr)",
    "Fetas de queso (3u)",
    "Fetas de jamon (3u)",
    "Queso untable (2 cdas)",
    "Huevo entero (3u)"
  ],
  proteinas_desayuno_merienda_no_entrenamiento: [
    "Vaso de leche (200cc)",
    "Vaso de yogur (200cc)",
    "Porción de queso (70gr)",
    "Fetas de queso (3u)",
    "Queso untable (2 cdas)",
    "Huevo entero (3u)"
  ],
  hidratos_desayuno_merienda: [
    "Pan lactal integral (3u)",
    "Pan de mesa (6u)",
    "Tostada de arroz (3u)",
    "Granola (140gr)",
    "Avena (140gr)",
    "Bay Biscuit (2u)"
  ],
  frutas: [
    "SI",
    "NO"
  ],
  frutas_no_entrenamiento: [
    "SI",
    "NO"
  ],
  grasas: [
    "4 nueces",
    "Pasta de maní",
    "½ palta"
  ],
  // Opciones separadas para almuerzo y cena
  proteinas_almuerzo_entrenamiento: [
    "Huevo entero (3u)",
    "Queso PortSalut (80gr)",
    "Ricota (80gr)",
    "Carne (280g)",
    "Pollo (280g)",
  ],
  hidratos_almuerzo_entrenamiento: [
    "Arroz cocido (330-360g)",
    "Pasta cocida (330-360g)",
    "Legumbres (340-360g)",
    "Choclo (340-360g)",
    "Soja (340-360g)",
    "Quinoa (330-360g)",
    "Trigo (330-360g)"
  ],
  vegetales_almuerzo_entrenamiento: [
    "SI",
    "NO"
  ],
  postres_almuerzo_entrenamiento: [
    "Flan",
    "Sin postre"
  ],
  proteinas_almuerzo_no_entrenamiento: [
    "Huevo entero (3u)",
    "Queso PortSalut (80gr)",
    "Ricota (80gr)",
    "Carne (200g)",
    "Pollo (200g)",
  ],
  hidratos_almuerzo_no_entrenamiento: [
    "Papa (2u med.)",
    "Camote (2u med.)",
    "Legumbres (200gr)",
    "Choclo (??)"
  ],
  vegetales_almuerzo_no_entrenamiento: [
    "SI",
    "NO"
  ],
  proteinas_cena: [
    "Huevo entero (3u)",
    "Ricota (80gr)",
    "Queso PortSalut (80gr)",
    "Carne (220g)",
    "Pollo (220g)",
    "Pescado (220g)"
  ],
  hidratos_cena: [
    "Papa (360-380g)",
    "Camote (360-380g)",
    "Legumbres (340-360g)",
    "Choclo (340-360g)"
  ],
  vegetales_cena: [
    "SI",
    "NO"
  ],
  postres_cena: [
    "Flan",
    "Sin postre"
  ],
  // Cena en días sin entrenamiento: cantidades originales, sin postre.
  proteinas_cena_no_entrenamiento: [
    "Huevo entero (3u)",
    "Ricota (80gr)",
    "Queso PortSalut (80gr)",
    "Carne (200g)",
    "Pollo (200g)",
    "Pescado (200g)"
  ],
  hidratos_cena_no_entrenamiento: [
    "Papa (2u med.)",
    "Camote (2u med.)",
    "Legumbres (200gr)",
    "Choclo (??)"
  ],
  vegetales_cena_no_entrenamiento: [
    "SI",
    "NO"
  ],
  suplementos: [
    "Creatina",
    "Proteína",
    "Muttant Mass (Scoop 1)",
    "Muttant Mass (Scoop 2)"
  ],
  eventualidades: [
    "Hamburguesa",
    "Helado",
    "Chocolate",
    "Pizza",
    "Asado",
    "Otro"
  ]
};

// 💊 Lista de suplementos disponibles para elegir por día
// const suplementos = [
//   "Creatina",
//   "Proteína",
//   "Muttant Mass (Scoop 1)",
//   "Muttant Mass (Scoop 2)"
// ];

// 🥗 Configuración de comidas para días de ENTRENAMIENTO
// Cada entrada representa una comida (ej: Desayuno) con los grupos de dropdowns que se van a mostrar
// Podés duplicar un grupo (como "proteinas") si querés mostrar dos dropdowns de ese tipo
const comidasEntrenamiento = [
  {
    nombre: "Desayuno",
    tipo: "desayuno_merienda",
    grupos: ["proteinas", "proteinas", "hidratos", "frutas", "grasas"]
  },
  {
    nombre: "Almuerzo",
    tipo: "almuerzo_entrenamiento",
    grupos: ["proteinas", "hidratos", "vegetales", "postres"]
  },
  {
    nombre: "Merienda",
    tipo: "desayuno_merienda",
    grupos: ["proteinas", "proteinas", "hidratos", "frutas"]
  },
  {
    nombre: "Cena",
    tipo: "cena",
    grupos: ["proteinas", "hidratos", "vegetales", "postres"]
  }
];

// 🛋️ Configuración de comidas para días SIN entrenamiento
const comidasNoEntrenamiento = [
  {
    nombre: "Desayuno",
    tipo: "no_entrenamiento",
    grupos: ["proteinas_desayuno_merienda_no_entrenamiento", "frutas_no_entrenamiento"]
  },
  {
    nombre: "Almuerzo",
    tipo: "almuerzo_no_entrenamiento",
    grupos: ["proteinas", "hidratos", "vegetales"]
  },
  {
    nombre: "Merienda",
    tipo: "no_entrenamiento",
    grupos: ["proteinas_desayuno_merienda_no_entrenamiento", "frutas_no_entrenamiento"]
  },
  {
    nombre: "Cena",
    tipo: "cena_no_entrenamiento",
    grupos: ["proteinas", "hidratos", "vegetales"]
  }
];

// 🔄 Recuperar opciones actuales desde localStorage (si existen)
function getOpciones() {
  const saved = JSON.parse(localStorage.getItem('opcionesDropdowns') || 'null');
  if (!saved) return JSON.parse(JSON.stringify(opciones));
  // Mergear claves nuevas de los defaults para usuarios que tenían config guardada
  // antes de que se agregaran grupos (postres, eventualidades, etc.).
  Object.keys(opciones).forEach(k => {
    if (!(k in saved)) saved[k] = opciones[k].slice();
  });
  return saved;
}

// 💾 Guardar opciones personalizadas al localStorage
function setOpciones(newOpc) {
  localStorage.setItem('opcionesDropdowns', JSON.stringify(newOpc));
}

// 🛠️ Crear un selector <select> para un grupo dado (ej: proteinas, hidratos...)
function crearSelector(grupo, idx, tipo, selected = null) {
  const select = document.createElement('select');
  // No usamos id: las comidas pueden tener grupos repetidos (ej: Desayuno con
  // dos "proteinas"), lo que generaría ids duplicados. Los callers ubican los
  // selects vía querySelectorAll dentro de su contenedor, en orden.
  // El name evita el warning de autofill del navegador; puede repetirse entre
  // selects de la misma comida sin problema.
  select.name = `${grupo}-${tipo || 'col'}`;
  select.dataset.grupo = grupo;

  let key;
  if (tipo === "almuerzo_entrenamiento") {
    key = `${grupo}_almuerzo_entrenamiento`;
  } else if (tipo === "almuerzo_no_entrenamiento") {
    key = `${grupo}_almuerzo_no_entrenamiento`;
  } else if (tipo === "cena") {
    key = `${grupo}_cena`;
  } else if (tipo === "cena_no_entrenamiento") {
    key = `${grupo}_cena_no_entrenamiento`;
  } else if ((grupo === "proteinas" || grupo === "hidratos") && tipo === "desayuno_merienda") {
    key = `${grupo}_desayuno_merienda`;
  } else {
    key = grupo;
  }

  const opcionesActuales = getOpciones()[key];
  if (Array.isArray(opcionesActuales)) {
    opcionesActuales.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o;
      opt.textContent = o;
      if (o === selected) opt.selected = true;
      select.appendChild(opt);
    });
  } else {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '(Sin opciones)';
    select.appendChild(opt);
  }

  return select;
}

// 🗓️ Cargar suplementos marcados para el día de hoy
function cargarSuplementosDia() {
  const div = document.getElementById('suplementos-dia');
  div.className = 'suplemento-container';
  div.innerHTML = '<strong>💊 Suplementos de hoy:</strong>';
  const key = new Date().toLocaleDateString('es-AR');
  const tomados = JSON.parse(localStorage.getItem('suplementosPorDia') || '{}')[key] || [];

  // Crear un contenedor con mejor diseño para los checkboxes
  const checkboxContainer = document.createElement('div');
  checkboxContainer.className = 'suplementos-checkboxes';

  getOpciones().suplementos.forEach(sup => {
    const label = document.createElement('label');
    label.className = 'suplemento-check';
    if (tomados.includes(sup)) label.classList.add('checked');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.name = 'suplemento';
    cb.value = sup;
    cb.checked = tomados.includes(sup);
    cb.onchange = () => {
      const m = JSON.parse(localStorage.getItem('suplementosPorDia') || '{}');
      const arr = m[key] || [];
      if (cb.checked) {
        arr.push(sup);
        label.classList.add('checked');
      } else {
        const i = arr.indexOf(sup);
        if (i >= 0) arr.splice(i, 1);
        label.classList.remove('checked');
      }
      m[key] = [...new Set(arr)];
      localStorage.setItem('suplementosPorDia', JSON.stringify(m));
      cargarHistorial();
    };

    label.appendChild(cb);
    label.append(' ' + sup);
    checkboxContainer.appendChild(label);
  });

  div.appendChild(checkboxContainer);
}

// 🧾 Cargar la lista de comidas del día actual (basado en tipo de día)
function cargarComidas() {
  const ul = document.getElementById('comidas-lista');
  ul.innerHTML = '';
  const hist = JSON.parse(localStorage.getItem('historialComidas') || '[]');
  const today = new Date().toLocaleDateString('es-AR');
  const tipoDia = document.getElementById('tipo-dia-select')?.value || 'entrenamiento';
  const comidas = tipoDia === 'entrenamiento' ? comidasEntrenamiento : comidasNoEntrenamiento;

  comidas.forEach((c, i) => {
    const li = document.createElement('li');

    const done = hist.some(x => {
      const d = x.fecha.split(',')[0].split(' ')[0].trim();
      return d === today && x.nombre === c.nombre;
    });

    if (done) li.classList.add('comida-completada', 'colapsada');

    // Encabezado de la comida con estado
    const comidaHeader = document.createElement('div');
    comidaHeader.className = 'comida-header';

    const titulo = document.createElement('div');
    titulo.className = 'comida-titulo';
    titulo.textContent = c.nombre;
    comidaHeader.appendChild(titulo);

    if (done) {
      const badge = document.createElement('span');
      badge.className = 'comida-badge';
      badge.textContent = '✓ Completada';
      comidaHeader.appendChild(badge);

      const toggle = document.createElement('button');
      toggle.className = 'comida-toggle';
      toggle.type = 'button';
      toggle.textContent = 'Ver';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.onclick = () => {
        const expanded = !li.classList.contains('colapsada');
        li.classList.toggle('colapsada');
        toggle.textContent = expanded ? 'Ver' : 'Ocultar';
        toggle.setAttribute('aria-expanded', String(!expanded));
      };
      comidaHeader.appendChild(toggle);
    }

    li.appendChild(comidaHeader);

    // Iconos para los grupos de alimentos
    const iconos = {
      proteinas: "🥩",
      hidratos: "🍞",
      frutas: "🍎",
      colaciones: "🧁",
      grasas: "🥑",
      vegetales: "🥦"
    };

    // Mostrar cada grupo de dropdowns
    c.grupos.forEach(g => {
      const grupoDiv = document.createElement('div');
      grupoDiv.className = 'comida-grupo';

      const base = g.split('_')[0]; // Para obtener el icono correspondiente
      const labelGrupo = g.replace(/_/g, ' ').toUpperCase();
      const icono = iconos[base] || '';

      const label = document.createElement('label');
      const labelText = document.createElement('span');
      labelText.className = 'comida-grupo-label';
      labelText.textContent = `${icono} ${labelGrupo}`;
      label.appendChild(labelText);

      const selector = crearSelector(g, i, c.tipo);
      if (done) selector.disabled = true;
      label.appendChild(selector);

      grupoDiv.appendChild(label);
      li.appendChild(grupoDiv);
    });

    // Botón para marcar comida como completada (solo si no está done)
    if (!done) {
      const btnContainer = document.createElement('div');
      btnContainer.className = 'comida-acciones';

      const btn = document.createElement('button');
      btn.textContent = 'Marcar como completada';
      btn.className = 'btn-completar';
      btn.onclick = () => marcarComida(i, li);

      btnContainer.appendChild(btn);
      li.appendChild(btnContainer);
    }

    ul.appendChild(li);
  });
}

// ✅ Guardar selección de una comida en el historial
function marcarComida(i, li) {
  const fecha = new Date().toLocaleString('es-AR');
  const tipoDia = document.getElementById('tipo-dia-select')?.value || 'entrenamiento';
  const comidasList = tipoDia === 'entrenamiento' ? comidasEntrenamiento : comidasNoEntrenamiento;
  const c = comidasList[i];
  const h = JSON.parse(localStorage.getItem('historialComidas') || '[]');

  // Guard: si esta comida ya está marcada hoy, no agregar duplicado.
  // Cubre casos donde la UI quedó desfasada (cache viejo, doble click, etc.).
  const today = new Date().toLocaleDateString('es-AR');
  const yaMarcada = h.some(x => {
    const d = x.fecha.split(',')[0].split(' ')[0].trim();
    return d === today && x.nombre === c.nombre;
  });
  if (yaMarcada) {
    cargarComidas();
    return;
  }

  const selects = li.querySelectorAll('select');
  const sel = c.grupos.map((g, idx) => `${g}: ${selects[idx]?.value ?? ''}`).join(', ');

  h.push({ nombre: c.nombre, seleccion: sel, fecha });
  localStorage.setItem('historialComidas', JSON.stringify(h));
  cargarComidas();
  cargarHistorial();
}

// 🖊️ Editar una entrada del historial directamente
function editarHistorial(idx, container) {
  const h = JSON.parse(localStorage.getItem('historialComidas') || '[]');
  const entry = h[idx];
  // Determinar si el registro es de entrenamiento o no
  // Detectar tipo de día por los grupos registrados
  let conf;
  if (entry.seleccion.includes('frutas_huevos') || entry.seleccion.includes('vegetales')) {
    conf = comidasNoEntrenamiento.find(c => c.nombre === entry.nombre);
  } else {
    conf = comidasEntrenamiento.find(c => c.nombre === entry.nombre);
  }
  const grupos = conf.grupos, tipo = conf.tipo;
  const currentMap = {};
  entry.seleccion.split(', ').forEach(pair => {
    const [g, val] = pair.split(': ');
    currentMap[g] = val;
  });
  container.innerHTML = '';
  const form = document.createElement('div');
    const iconos = {
  proteinas: "🥩",
  hidratos: "🍞",
  frutas: "🍎",
  colaciones: "🧁",
  grasas: "🥑",
  vegetales: "🥦"
};
grupos.forEach(g => {
  const lbl = document.createElement('label');
  lbl.className = 'editar-historial-label';
  const base = g.split('_')[0];
  const labelGrupo = g.replace(/_/g, ' ').toUpperCase();
  const icono = iconos[base] || '';
  const labelSpan = document.createElement('span');
  labelSpan.className = 'editar-historial-label-text';
  labelSpan.textContent = `${icono} ${labelGrupo}`;
  lbl.appendChild(labelSpan);
  lbl.appendChild(crearSelector(g, idx, tipo, currentMap[g]));
  form.appendChild(lbl);
});

  const btnSave = document.createElement('button');
  btnSave.textContent = 'Guardar';
  btnSave.onclick = () => {
    const selects = form.querySelectorAll('select');
    entry.seleccion = grupos.map((gp, gIdx) => `${gp}: ${selects[gIdx]?.value ?? ''}`).join(', ');
    h[idx] = entry;
    localStorage.setItem('historialComidas', JSON.stringify(h));
    cargarHistorial();
  };
  const btnCancel = document.createElement('button');
  btnCancel.textContent = 'Cancelar';
  btnCancel.className = 'editar-historial-cancel';
  btnCancel.onclick = cargarHistorial;
  form.appendChild(btnSave);
  form.appendChild(btnCancel);
  container.appendChild(form);
}

// 📜 Cargar historial completo de comidas
function cargarHistorial() {
  const ul = document.getElementById('historial-lista');
  ul.innerHTML = '';
  const h = JSON.parse(localStorage.getItem('historialComidas') || '[]');
  const eventualidadesAll = JSON.parse(localStorage.getItem('eventualidadesSemanales') || '[]');
  const dias = {};
  const eventualidadesPorDia = {};

  // Agrupar comidas por fecha
  h.forEach((item, idx) => {
    const d = item.fecha.split(',')[0].split(' ')[0].trim();
    if (!dias[d]) dias[d] = [];
    dias[d].push({ item, idx });
  });

  // Agrupar eventualidades por fecha y asegurar que aparezcan días con
  // eventualidades aunque no haya comidas registradas.
  eventualidadesAll.forEach(e => {
    if (!e.fecha) return;
    if (!eventualidadesPorDia[e.fecha]) eventualidadesPorDia[e.fecha] = [];
    eventualidadesPorDia[e.fecha].push(e);
    if (!dias[e.fecha]) dias[e.fecha] = [];
  });

  // Ordenar fechas de más reciente a más antigua
  Object.keys(dias).sort((a, b) => {
    // Convertir dd/mm/yyyy a objetos Date para comparar
    const [dA, mA, yA] = a.split('/');
    const [dB, mB, yB] = b.split('/');
    return new Date(yB, mB-1, dB) - new Date(yA, mA-1, dA);
  }).forEach(fecha => {
    const li = document.createElement('li');
    li.className = 'historial-fecha';

    // Obtener datos de agua, jugo y suplementos
    const wc = JSON.parse(localStorage.getItem('waterCounts') || '{}')[fecha] || 0;
    const jc = JSON.parse(localStorage.getItem('jugoCounts') || '{}')[fecha] || 0;
    const sup = (JSON.parse(localStorage.getItem('suplementosPorDia') || '{}')[fecha] || []);

    // Crear cabecera del día con iconos
    const dateHeader = document.createElement('div');
    dateHeader.className = 'historial-fecha-header';

    const dateText = document.createElement('span');
    dateText.className = 'historial-fecha-texto';
    dateText.innerHTML = `<strong>${fecha}</strong> <span class="toggle-icon">▼</span>`;

    const badgesContainer = document.createElement('div');
    badgesContainer.className = 'historial-badges';

    // Badge de agua
    const waterBadge = document.createElement('span');
    waterBadge.className = 'historial-badge historial-badge--agua';
    waterBadge.textContent = `💧 ${wc}`;
    badgesContainer.appendChild(waterBadge);

    // Badge de jugo (si hay)
    if (jc > 0) {
      const jugoBadge = document.createElement('span');
      jugoBadge.className = 'historial-badge historial-badge--jugo';
      jugoBadge.textContent = `🧃 ${jc}`;
      badgesContainer.appendChild(jugoBadge);
    }

    // Badges de suplementos (si hay)
    if (sup.length > 0) {
      const supBadge = document.createElement('span');
      supBadge.className = 'historial-badge historial-badge--sup';
      supBadge.textContent = `💊 ${sup.length}`;
      supBadge.title = sup.join(', ');
      badgesContainer.appendChild(supBadge);
    }

    // Badge de eventualidades (si hay)
    const eventosDia = eventualidadesPorDia[fecha] || [];
    if (eventosDia.length > 0) {
      const eventoBadge = document.createElement('span');
      eventoBadge.className = 'historial-badge historial-badge--evento';
      eventoBadge.textContent = `🎉 ${eventosDia.length}`;
      eventoBadge.title = eventosDia.map(e => e.tipo).join(', ');
      badgesContainer.appendChild(eventoBadge);
    }

    dateHeader.appendChild(dateText);
    dateHeader.appendChild(badgesContainer);
    li.appendChild(dateHeader);

    ul.appendChild(li);

    // Lista de comidas del día
    const inner = document.createElement('ul');

    // Eventualidades del día como primer item (si hay)
    if (eventosDia.length > 0) {
      const liEvento = document.createElement('li');
      liEvento.className = 'historial-eventualidades-item';
      const labelEv = document.createElement('span');
      labelEv.className = 'historial-eventualidades-label';
      labelEv.textContent = '🎉 Eventualidades:';
      const valorEv = document.createElement('span');
      valorEv.className = 'historial-eventualidades-valor';
      valorEv.textContent = eventosDia.map(e => e.tipo).join(', ');
      liEvento.appendChild(labelEv);
      liEvento.appendChild(valorEv);
      inner.appendChild(liEvento);
    }

    dias[fecha].forEach(({ item, idx }) => {
      const li2 = document.createElement('li');

      // Cabecera con el nombre de la comida y botón de editar
      const comidaHeader = document.createElement('div');
      comidaHeader.className = 'historial-comida-header';

      const nombreComida = document.createElement('span');
      nombreComida.className = 'historial-item-nombre';
      nombreComida.textContent = item.nombre;

      const btnEdit = document.createElement('button');
      btnEdit.className = 'btn-outline';
      btnEdit.innerHTML = '✏️ Editar';
      btnEdit.onclick = () => editarHistorial(idx, li2);

      comidaHeader.appendChild(nombreComida);
      comidaHeader.appendChild(btnEdit);
      li2.appendChild(comidaHeader);

      // Detalles de la selección con iconos
      const spanSel = document.createElement('div');
      spanSel.className = 'historial-item-seleccion';

      const iconos = {
        proteinas: "🥩",
        hidratos: "🍞",
        frutas: "🍎",
        colaciones: "🧁",
        grasas: "🥑",
        vegetales: "🥦"
      };

      const detallesContainer = document.createElement('div');
      detallesContainer.className = 'historial-detalles';

      item.seleccion.split(', ').forEach(pair => {
        const [grupo, valor] = pair.split(': ');
        const base = grupo.split('_')[0];
        const icono = iconos[base] || '';
        const nombreCompleto = grupo.replace(/_/g, ' ').toUpperCase();

        const detalleFila = document.createElement('div');
        detalleFila.className = 'historial-detalle-fila';

        const labelGrupo = document.createElement('span');
        labelGrupo.className = 'historial-detalle-label';
        labelGrupo.textContent = `${icono} ${nombreCompleto}`;

        const valorSpan = document.createElement('span');
        valorSpan.className = 'historial-detalle-valor';
        valorSpan.textContent = valor;

        detalleFila.appendChild(labelGrupo);
        detalleFila.appendChild(valorSpan);
        detallesContainer.appendChild(detalleFila);
      });

      spanSel.appendChild(detallesContainer);
      li2.appendChild(spanSel);

      inner.appendChild(li2);
    });

    ul.appendChild(inner);

    // Manejo de expansión/colapso
    let open = true;
    const toggleIcon = li.querySelector('.toggle-icon');

    li.onclick = (e) => {
      open = !open;
      inner.hidden = !open;
      toggleIcon.textContent = open ? '▼' : '▶';
    };
  });
}

// — Agua por día —
function getTodayKey() { return new Date().toLocaleDateString('es-AR'); }
function getWaterCount(key) { return JSON.parse(localStorage.getItem('waterCounts') || '{}')[key] || 0; }
function setWaterCount(key, v) {
  const m = JSON.parse(localStorage.getItem('waterCounts') || '{}');
  m[key] = v;
  localStorage.setItem('waterCounts', JSON.stringify(m));
}

// — Jugo Ades por día —
function getJugoCount(key) { return JSON.parse(localStorage.getItem('jugoCounts') || '{}')[key] || 0; }
function setJugoCount(key, v) {
  const m = JSON.parse(localStorage.getItem('jugoCounts') || '{}');
  m[key] = v;
  localStorage.setItem('jugoCounts', JSON.stringify(m));
}

// — Eventualidades semanales (lunes a domingo) —
function getInicioSemana(d = new Date()) {
  // Devuelve un Date al lunes 00:00 de la semana de d.
  const dia = d.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
  const offset = dia === 0 ? -6 : 1 - dia;
  const lunes = new Date(d);
  lunes.setDate(d.getDate() + offset);
  lunes.setHours(0, 0, 0, 0);
  return lunes;
}

function getFinSemana(d = new Date()) {
  const lunes = getInicioSemana(d);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 7); // exclusivo
  return domingo;
}

function parseFechaArg(fechaStr) {
  // Parsea "DD/M/YYYY" o "DD/MM/YYYY" a Date.
  const [d, m, y] = fechaStr.split('/').map(Number);
  return new Date(y, m - 1, d);
}

function getEventualidadesSemana() {
  const todas = JSON.parse(localStorage.getItem('eventualidadesSemanales') || '[]');
  const inicio = getInicioSemana();
  const fin = getFinSemana();
  return todas.filter(e => {
    const f = parseFechaArg(e.fecha);
    return f >= inicio && f < fin;
  });
}

function agregarEventualidad(tipo) {
  const todas = JSON.parse(localStorage.getItem('eventualidadesSemanales') || '[]');
  todas.push({ fecha: getTodayKey(), tipo, ts: Date.now() });
  localStorage.setItem('eventualidadesSemanales', JSON.stringify(todas));
}

function quitarEventualidad(ts) {
  const todas = JSON.parse(localStorage.getItem('eventualidadesSemanales') || '[]');
  const i = todas.findIndex(e => e.ts === ts);
  if (i >= 0) {
    todas.splice(i, 1);
    localStorage.setItem('eventualidadesSemanales', JSON.stringify(todas));
  }
}

function cargarEventualidades() {
  const cont = document.getElementById('eventualidades-semana');
  if (!cont) return;
  cont.innerHTML = '';

  const eventos = getEventualidadesSemana();
  const limite = 3;

  const header = document.createElement('div');
  header.className = 'eventualidades-header';

  const titulo = document.createElement('span');
  titulo.className = 'eventualidades-titulo';
  titulo.textContent = '🎉 Eventualidades de la semana';

  const contador = document.createElement('span');
  contador.className = 'eventualidades-contador';
  contador.textContent = `${eventos.length} / ${limite}`;

  header.appendChild(titulo);
  header.appendChild(contador);
  cont.appendChild(header);

  if (eventos.length >= limite) {
    const aviso = document.createElement('p');
    aviso.className = 'eventualidades-empty';
    aviso.textContent = 'Ya alcanzaste el límite de la semana. ¡Buen trabajo!';
    cont.appendChild(aviso);
  } else {
    const addRow = document.createElement('div');
    addRow.className = 'eventualidades-add';

    const select = document.createElement('select');
    select.name = 'eventualidad-tipo';
    select.setAttribute('aria-label', 'Tipo de eventualidad');
    (getOpciones().eventualidades || []).forEach(opt => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      select.appendChild(o);
    });

    const btn = document.createElement('button');
    btn.textContent = '+ Agregar';
    btn.className = 'btn-outline';
    btn.onclick = () => {
      if (!select.value) return;
      agregarEventualidad(select.value);
      cargarEventualidades();
    };

    addRow.appendChild(select);
    addRow.appendChild(btn);
    cont.appendChild(addRow);
  }

  if (eventos.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'eventualidades-empty';
    empty.textContent = 'Sin eventualidades esta semana.';
    cont.appendChild(empty);
    return;
  }

  const ul = document.createElement('ul');
  ul.className = 'eventualidades-lista';
  // Más recientes primero
  eventos.slice().sort((a, b) => b.ts - a.ts).forEach(e => {
    const li = document.createElement('li');

    const tipoSpan = document.createElement('span');
    tipoSpan.textContent = e.tipo;

    const fechaSpan = document.createElement('span');
    fechaSpan.className = 'eventualidad-fecha';
    fechaSpan.textContent = e.fecha;

    const acciones = document.createElement('div');
    acciones.className = 'eventualidad-acciones';
    acciones.appendChild(fechaSpan);

    const btnQuitar = document.createElement('button');
    btnQuitar.className = 'eventualidad-quitar';
    btnQuitar.textContent = '✖';
    btnQuitar.setAttribute('aria-label', `Quitar ${e.tipo}`);
    btnQuitar.onclick = () => {
      quitarEventualidad(e.ts);
      cargarEventualidades();
    };
    acciones.appendChild(btnQuitar);

    li.appendChild(tipoSpan);
    li.appendChild(acciones);
    ul.appendChild(li);
  });
  cont.appendChild(ul);
}


// Función para modificar los grupos de comidas (añadir/quitar dropdowns)
function modificarGruposComida(comidaNombre, tipoComida, grupo, accion) {
  const lista = tipoComida === 'entrenamiento' ? comidasEntrenamiento : comidasNoEntrenamiento;
  const comida = lista.find(c => c.nombre === comidaNombre);

  if (!comida) return false;

  // Para añadir un grupo
  if (accion === 'agregar') {
    comida.grupos.push(grupo);
  }
  // Para quitar un grupo
  else if (accion === 'quitar') {
    const index = comida.grupos.indexOf(grupo);
    if (index > -1) {
      comida.grupos.splice(index, 1);
    }
  }

  // Guardar los cambios en localStorage
  localStorage.setItem('comidasEntrenamiento', JSON.stringify(comidasEntrenamiento));
  localStorage.setItem('comidasNoEntrenamiento', JSON.stringify(comidasNoEntrenamiento));

  // Actualizar todas las interfaces que dependen de esta configuración
  cargarComidas();
  return true;
}

// — Render opciones de dropdowns (Opciones de Dropdowns) —
function renderOpcionesForm() {
  const cont = document.getElementById('opciones-form');
  if (!cont) return; // Salir si no encontramos el contenedor
  cont.innerHTML = '';

  // Asegurarnos de obtener los datos más recientes
  const current = getOpciones();

  // Primero, renderizar la sección para configurar grupos de comidas
  const configSection = document.createElement('div');
  configSection.className = 'config-grupos-section';

  const h3 = document.createElement('h3');
  h3.textContent = 'Configurar Grupos por Comida';
  configSection.appendChild(h3);

  // Crear pestañas para entrenamiento y no entrenamiento
  const tabsDiv = document.createElement('div');
  tabsDiv.className = 'dropdown-config-tabs';

  const btnEntrenamiento = document.createElement('button');
  btnEntrenamiento.textContent = '💪 Día de entrenamiento';
  btnEntrenamiento.className = 'config-tab active';
  btnEntrenamiento.onclick = () => mostrarConfigComidas('entrenamiento');

  const btnNoEntrenamiento = document.createElement('button');
  btnNoEntrenamiento.textContent = '🛋️ Día sin entrenamiento';
  btnNoEntrenamiento.className = 'config-tab';
  btnNoEntrenamiento.onclick = () => mostrarConfigComidas('no_entrenamiento');

  tabsDiv.appendChild(btnEntrenamiento);
  tabsDiv.appendChild(btnNoEntrenamiento);
  configSection.appendChild(tabsDiv);

  // Contenedor para la configuración
  const configComidasDiv = document.createElement('div');
  configComidasDiv.id = 'dropdown-config-contenido';
  configSection.appendChild(configComidasDiv);

  // Función para mostrar los grupos por tipo de día
  function mostrarConfigComidas(tipoDia) {
    // Actualizar botones activos
    document.querySelectorAll('.config-tab').forEach(b => b.classList.remove('active'));
    if (tipoDia === 'entrenamiento') {
      btnEntrenamiento.classList.add('active');
    } else {
      btnNoEntrenamiento.classList.add('active');
    }

    // Usar las referencias en memoria actualizadas
    const lista = tipoDia === 'entrenamiento' ? comidasEntrenamiento : comidasNoEntrenamiento;

    configComidasDiv.innerHTML = '';

    // Listar cada comida con sus grupos
    lista.forEach(comida => {
      const comidaDiv = document.createElement('div');
      comidaDiv.className = 'comida-grupos';

      // Encabezado de la comida con estilo mejorado
      const comidaHeader = document.createElement('div');
      comidaHeader.className = 'comida-grupos-header';

      const h4 = document.createElement('h4');
      h4.textContent = comida.nombre;
      h4.className = 'comida-grupos-titulo';

      // Contador de grupos
      const grupoCount = document.createElement('span');
      grupoCount.textContent = `${comida.grupos.length} grupo(s)`;
      grupoCount.className = 'comida-grupos-count';
// Función para mostrar mensaje y restaurar grupo eliminado en Configurar Grupos por Comida
function mostrarMensajeRestaurarGrupo(mensaje, comidaNombre, tipoDia, grupo, idx) {
  let msgContainer = document.getElementById('mensaje-container');
  if (!msgContainer) {
    msgContainer = document.createElement('div');
    msgContainer.id = 'mensaje-container';
    msgContainer.className = 'mensaje-container';
    document.body.appendChild(msgContainer);
  }

  const msgElement = document.createElement('div');
  msgElement.className = 'mensaje info';
  msgElement.innerHTML = `<div class=\"mensaje-contenido\"><span class=\"mensaje-icono\">ℹ️</span> ${mensaje}</div>`;

  // Botón de cerrar con restaurar
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.className = 'mensaje-cerrar';
  closeBtn.onclick = () => {
    // Restaurar el grupo eliminado (último de la pila)
    const ultimo = gruposEliminadosStack.pop();
    if (ultimo) {
      const lista = ultimo.tipoDia === 'entrenamiento' ? comidasEntrenamiento : comidasNoEntrenamiento;
      const comida = lista.find(c => c.nombre === ultimo.comidaNombre);
      if (comida) {
        comida.grupos.splice(ultimo.idx, 0, ultimo.grupo);
        // Guardar los cambios en localStorage
        localStorage.setItem('comidasEntrenamiento', JSON.stringify(comidasEntrenamiento));
        localStorage.setItem('comidasNoEntrenamiento', JSON.stringify(comidasNoEntrenamiento));
        renderOpcionesForm();
        mostrarConfigComidas(ultimo.tipoDia);
      }
    }
    msgContainer.removeChild(msgElement);
  };
  msgElement.querySelector('.mensaje-contenido').appendChild(closeBtn);

  msgContainer.appendChild(msgElement);
  setTimeout(() => msgElement.classList.add('visible'), 10);
  setTimeout(() => {
    if (msgElement.parentNode) {
      msgElement.classList.remove('visible');
      setTimeout(() => {
        if (msgElement.parentNode) {
          msgElement.parentNode.removeChild(msgElement);
        }
      }, 300);
    }
  }, 6000);
}
      comidaHeader.appendChild(h4);
      comidaHeader.appendChild(grupoCount);
      comidaDiv.appendChild(comidaHeader);

      // Listar los grupos actuales con estilo mejorado
      if (comida.grupos.length > 0) {
        const gruposContainer = document.createElement('div');
        gruposContainer.className = 'comida-grupos-lista';

        comida.grupos.forEach((grupo, grupoIdx) => {
          const grupoItem = document.createElement('div');
          grupoItem.className = 'comida-grupos-item';

          // Iconos para cada tipo de grupo
          const iconos = {
            proteinas: "🥩",
            hidratos: "🍞",
            frutas: "🍎",
            colaciones: "🧁",
            grasas: "🥑",
            vegetales: "🥦"
          };
          const base = grupo.split('_')[0];
          const icono = iconos[base] || '';

          const grupoLabel = document.createElement('div');
          grupoLabel.innerHTML = `<span class="grupo-icono">${icono}</span> ${grupo.replace(/_/g, ' ').toUpperCase()}`;

          const btnQuitar = document.createElement('button');
          btnQuitar.className = 'btn-delete btn-icon';
          btnQuitar.innerHTML = '✖';
          btnQuitar.title = 'Quitar este grupo';
          btnQuitar.setAttribute('aria-label', `Quitar grupo ${grupo}`);
          btnQuitar.onclick = () => {
            // Guardar en la pila de eliminados de grupos
            gruposEliminadosStack.push({
              comidaNombre: comida.nombre,
              tipoDia,
              grupo,
              idx: grupoIdx
            });
            if (modificarGruposComida(comida.nombre, tipoDia, grupo, 'quitar')) {
              mostrarConfigComidas(tipoDia);
              mostrarMensajeRestaurarGrupo(`Grupo "${grupo.replace(/_/g, ' ').toUpperCase()}" eliminado de ${comida.nombre}. Haz clic en la X para restaurar.`, comida.nombre, tipoDia, grupo, grupoIdx);
            }
          };

          grupoItem.appendChild(grupoLabel);
          grupoItem.appendChild(btnQuitar);
          gruposContainer.appendChild(grupoItem);
        });

        comidaDiv.appendChild(gruposContainer);
      } else {
        // Mostrar mensaje si no hay grupos
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = 'No hay grupos configurados para esta comida.';
        emptyMessage.className = 'comida-grupos-empty';
        comidaDiv.appendChild(emptyMessage);
      }

      // Selector para añadir grupos con mejor estilo
      const addGroupDiv = document.createElement('div');
      addGroupDiv.className = 'add-grupo-row';

      const select = document.createElement('select');
      select.className = 'select-add-grupo';
      select.name = 'add-grupo';
      select.setAttribute('aria-label', `Agregar grupo a ${comida.nombre}`);

      // Opciones disponibles para añadir con iconos
      const opcionesGrupo = [
        'proteinas', 'hidratos', 'frutas', 'grasas', 'vegetales', 'colaciones',
        'proteinas_desayuno_merienda', 'hidratos_desayuno_merienda', 'frutas_no_entrenamiento', 'proteinas_desayuno_merienda_no_entrenamiento'
      ];

      const iconos = {
        proteinas: "🥩",
        hidratos: "🍞",
        frutas: "🍎",
        colaciones: "🧁",
        grasas: "🥑",
        vegetales: "🥦"
      };

      opcionesGrupo.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;

        const base = opt.split('_')[0];
        const icono = iconos[base] || '';
        option.textContent = `${icono} ${opt.replace(/_/g, ' ').toUpperCase()}`;

        select.appendChild(option);
      });

      const btnAdd = document.createElement('button');
      btnAdd.className = 'btn-outline btn-add';
      btnAdd.innerHTML = '➕ Agregar';
      btnAdd.onclick = () => {
        const grupoSeleccionado = select.value;
        if (modificarGruposComida(comida.nombre, tipoDia, grupoSeleccionado, 'agregar')) {
          mostrarConfigComidas(tipoDia);
        }
      };

      addGroupDiv.appendChild(select);
      addGroupDiv.appendChild(btnAdd);
      comidaDiv.appendChild(addGroupDiv);

      configComidasDiv.appendChild(comidaDiv);
    });
  }

  // Mostrar configuración para día de entrenamiento por defecto
  mostrarConfigComidas('entrenamiento');

  cont.appendChild(configSection);

  // Agregar separador visual
  const separator = document.createElement('div');
  separator.className = 'config-separator';
  cont.appendChild(separator);

  // Título para la sección de alimentos
  const tituloAlimentos = document.createElement('h3');
  tituloAlimentos.textContent = 'Configuración de Alimentos';
  tituloAlimentos.className = 'config-section-title';
  cont.appendChild(tituloAlimentos);

  // Contenedor flexible para las tarjetas de opciones
  const opcionesGrid = document.createElement('div');
  opcionesGrid.className = 'opciones-form';
  cont.appendChild(opcionesGrid);

  // Renderizar opciones de alimentos
  Object.keys(opciones).forEach(grupoKey => {
    const div = document.createElement('div');
    div.className = 'grupo-opciones';

    // Usar el nombre completo del grupo reemplazando guiones bajos por espacios
    const base = grupoKey.split('_')[0]; // Para obtener el tipo base (proteinas, hidratos, etc.)
    const labelGrupo = grupoKey.replace(/_/g, ' ').toUpperCase();

    // Agregar icono al grupo
    const iconos = {
      proteinas: "🥩",
      hidratos: "🍞",
      frutas: "🍎",
      colaciones: "🧁",
      grasas: "🥑",
      vegetales: "🥦",
      suplementos: "💊"
    };
    const icono = iconos[base] || '';

    div.innerHTML = `<strong><span class="grupo-icono">${icono}</span> ${labelGrupo}</strong>`;

    // Lista de opciones actuales
    const ul = document.createElement('ul');
    if (Array.isArray(current[grupoKey])) {
      if (current[grupoKey].length === 0) {
        const li = document.createElement('li');
        li.textContent = '(Sin opciones)';
        li.className = 'grupo-empty-item';
        ul.appendChild(li);
      } else {
        current[grupoKey].forEach((opt, idx) => {
          const li = document.createElement('li');

          const optionText = document.createElement('span');
          optionText.textContent = opt;

          const btnDel = document.createElement('button');
          btnDel.innerHTML = '✖';
          btnDel.className = 'btn-delete btn-icon';
          btnDel.title = 'Eliminar este alimento';
          btnDel.setAttribute('aria-label', `Eliminar ${opt}`);

          btnDel.onclick = () => {
            // Guardar el eliminado en la pila para restaurar múltiples
            const valorEliminado = current[grupoKey][idx];
            current[grupoKey].splice(idx, 1);
            setOpciones(current);
            renderOpcionesForm();
            cargarComidas();
            mostrarMensajeRestaurar(`Opción "${valorEliminado}" eliminada de ${labelGrupo}. Haz clic en la X para restaurar.`, grupoKey, valorEliminado, idx);
          };

          li.appendChild(optionText);
          li.appendChild(btnDel);
          ul.appendChild(li);
        });
      }
    }
    div.appendChild(ul);

    // Formulario para agregar nuevas opciones
    const addForm = document.createElement('div');
    addForm.className = 'add-opcion-row';

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.name = `nuevo-${grupoKey}`;
    inp.placeholder = `Nuevo alimento...`;
    inp.setAttribute('aria-label', `Nuevo ${labelGrupo}`);

    const btnAdd = document.createElement('button');
    btnAdd.textContent = 'Agregar';

    btnAdd.onclick = () => {
      const val = inp.value.trim();
      if (!Array.isArray(current[grupoKey])) current[grupoKey] = [];

      if (val && !current[grupoKey].includes(val)) {
        current[grupoKey].push(val);
        setOpciones(current);
        renderOpcionesForm();
        cargarComidas();
        inp.value = '';
      }
    };

    // También permitir agregar con Enter
    inp.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        btnAdd.click();
      }
    });

    addForm.appendChild(inp);
    addForm.appendChild(btnAdd);
    div.appendChild(addForm);

    opcionesGrid.appendChild(div);
  });
}

// — Inicialización —
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('export-csv').onclick = exportarHistorialCSV;
  document.getElementById('import-csv').onchange = e => {
    if (e.target.files[0]) importarHistorialCSV(e.target.files[0]);
  };

  // Cargar configuraciones de comidas usando la función dedicada
  cargarConfiguracionComidas();

  cargarComidas();
  // Cambiar comidas al cambiar tipo de día
  document.getElementById('tipo-dia-select').onchange = cargarComidas;
  cargarHistorial();
  cargarSuplementosDia();
  cargarEventualidades();

  // Agua
  const waterSpan = document.getElementById('water-count');
  waterSpan.textContent = getWaterCount(getTodayKey());
  document.getElementById('add-water').onclick = () => {
    const k = getTodayKey();
    const v = getWaterCount(k) + 1;
    setWaterCount(k, v);
    waterSpan.textContent = v;
    cargarHistorial();
  };
  document.getElementById('reset-water').onclick = () => {
    const k = getTodayKey();
    setWaterCount(k, 0);
    waterSpan.textContent = 0;
    cargarHistorial();
  };

  // Jugo Ades
  const jugoSpan = document.getElementById('jugo-count');
  jugoSpan.textContent = getJugoCount(getTodayKey());
  document.getElementById('add-jugo').onclick = () => {
    const k = getTodayKey();
    const v = getJugoCount(k) + 1;
    setJugoCount(k, v);
    jugoSpan.textContent = v;
    cargarHistorial();
  };
  document.getElementById('reset-jugo').onclick = () => {
    const k = getTodayKey();
    setJugoCount(k, 0);
    jugoSpan.textContent = 0;
    cargarHistorial();
  };

  // Tabs
  function showTab(tab) {
    document.querySelectorAll('.tab-content').forEach(s => { s.hidden = true; });
    document.getElementById('tab-content-' + tab).hidden = false;
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    const btn = document.getElementById('tab-' + tab);
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    // Actualizar variable global de pestaña actual
    tabActual = tab;
  }
  document.getElementById('tab-principal').onclick = () => showTab('principal');
  document.getElementById('tab-historial').onclick = () => showTab('historial');
  document.getElementById('tab-opciones').onclick = () => showTab('opciones');
  document.getElementById('tab-ayuda').onclick = () => showTab('ayuda');

  showTab('principal');

  renderOpcionesForm();

  document.getElementById('reiniciar-app').onclick = () => {
    if (confirm('¿Querés reiniciar la app? Se eliminarán todos los datos y se restaurarán las opciones por defecto.')) {
      localStorage.clear();
      alert('App reiniciada. Se restauró la configuración original.');
      location.reload();
    }
  };
});

// — Registrar Service Worker —
if ('serviceWorker' in navigator) {
  // Si ya había una SW controlando la página y aparece una nueva (deploy con
  // CACHE_NAME bumpeado), recargar automáticamente para que el usuario vea la
  // versión nueva en este mismo open en vez del siguiente.
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  // Usar una ruta relativa para que funcione en GitHub Pages
  const swPath = new URL('service-worker.js', window.location.href).pathname;
  navigator.serviceWorker.register(swPath)
    .catch(err => console.error('SW fallo', err));
}
