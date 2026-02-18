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
  const suplementosPorDia = JSON.parse(localStorage.getItem('suplementosPorDia') || '{}');
  if (!historial.length) {
    console.warn('No hay historial de comidas, pero se exportarán suplementos, agua y opciones.');
  }
  const dias = {};
  historial.forEach(item => {
    const fechaSolo = item.fecha.split(',')[0].split(' ')[0].trim();
    if (!dias[fechaSolo]) dias[fechaSolo] = [];
    dias[fechaSolo].push(item);
  });
  let csv = 'Fecha,Agua,Suplementos,Comida,Selección\n';
  Object.keys(dias).sort((a, b) => {
    const [da, ma, ya] = a.split('/');
    const [db, mb, yb] = b.split('/');
    return new Date(`${yb}-${mb}-${da}`) - new Date(`${ya}-${ma}-${da}`);
  }).forEach(fecha => {
    const agua = waterCounts[fecha] || 0;
    const suplementos = (suplementosPorDia[fecha] || []).join(' | ');
    dias[fecha].forEach(item => {
      const fechaCSV = `"${fecha.replace(/"/g, '""')}"`;
      const aguaCSV = `"${agua}"`;
      const suplementosCSV = `"${suplementos.replace(/"/g, '""')}"`;
      const nombre = `"${(item.nombre || '').replace(/"/g, '""')}"`;
      const seleccion = `"${(item.seleccion || '').replace(/"/g, '""')}"`;
      csv += `${fechaCSV},${aguaCSV},${suplementosCSV},${nombre},${seleccion}\n`;
    });
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
    // Separar historial y opciones
    let opcionesStart = lines.findIndex(l => l.toLowerCase().includes('opciones de dropdowns'));
    let historialLines = opcionesStart > -1 ? lines.slice(0, opcionesStart) : lines;
    let opcionesLines = opcionesStart > -1 ? lines.slice(opcionesStart + 1) : [];

    // Buscar secciones de configuración de comidas
    let entrenamientoStart = lines.findIndex(l => l.toLowerCase().includes('configuración de comidas - entrenamiento'));
    let noEntrenamientoStart = lines.findIndex(l => l.toLowerCase().includes('configuración de comidas - sin entrenamiento'));

    console.log('Líneas en CSV:', lines.length);
    console.log('Posición de sección entrenamiento:', entrenamientoStart);
    console.log('Posición de sección no entrenamiento:', noEntrenamientoStart);

    // Extraer líneas de cada sección correctamente
    let entrenamientoLines = [];
    let noEntrenamientoLines = [];

    if (entrenamientoStart > -1) {
      // Buscar el final de la sección de entrenamiento
      const finEntrenamiento = noEntrenamientoStart > -1 ? noEntrenamientoStart :
                              lines.findIndex((l, i) => i > entrenamientoStart && l.trim() === '');

      const endIdx = finEntrenamiento > -1 ? finEntrenamiento : lines.length;
      entrenamientoLines = lines.slice(entrenamientoStart + 1, endIdx).filter(l => l.trim() && l.includes(','));
      console.log('Líneas de entrenamiento encontradas:', entrenamientoLines.length);
    }

    if (noEntrenamientoStart > -1) {
      // Buscar el final de la sección de no entrenamiento
      const finNoEntrenamiento = lines.findIndex((l, i) => i > noEntrenamientoStart && l.trim() === '');

      const endIdx = finNoEntrenamiento > -1 ? finNoEntrenamiento : lines.length;
      noEntrenamientoLines = lines.slice(noEntrenamientoStart + 1, endIdx).filter(l => l.trim() && l.includes(','));
      console.log('Líneas de no entrenamiento encontradas:', noEntrenamientoLines.length);
    }

    // Procesar historial
    const headers = historialLines[0].split(',');
    const idxFecha = headers.findIndex(h => h.toLowerCase().includes('fecha'));
    const idxAgua = headers.findIndex(h => h.toLowerCase().includes('agua'));
    const idxSup = headers.findIndex(h => h.toLowerCase().includes('suplementos'));
    const idxComida = headers.findIndex(h => h.toLowerCase().includes('comida'));
    const idxSel = headers.findIndex(h => h.toLowerCase().includes('selección'));
    if (idxFecha < 0 || idxComida < 0 || idxSel < 0) {
      alert('CSV en formato inesperado.');
      return;
    }
    const waterCounts = {};
    const suplementosPorDia = {};
    const historial = [];
    for (let i = 1; i < historialLines.length; i++) {
      const cols = historialLines[i].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      const fecha = (cols[idxFecha] || '').replace(/(^"|"$)/g, '').trim();
      const agua = (cols[idxAgua] || '').replace(/(^"|"$)/g, '').trim();
      const sup = (cols[idxSup] || '').replace(/(^"|"$)/g, '').trim();
      const nombre = (cols[idxComida] || '').replace(/(^"|"$)/g, '').trim();
      const seleccion = (cols[idxSel] || '').replace(/(^"|"$)/g, '').trim();
      if (fecha) {
        if (agua) waterCounts[fecha] = parseInt(agua, 10) || 0;
        if (sup) suplementosPorDia[fecha] = sup.split(' | ').map(s => s.trim());
      }
      if (fecha && nombre) {
        historial.push({ fecha, nombre, seleccion });
      }
    }
    localStorage.setItem('waterCounts', JSON.stringify(waterCounts));
    localStorage.setItem('suplementosPorDia', JSON.stringify(suplementosPorDia));
    localStorage.setItem('historialComidas', JSON.stringify(historial));

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
      console.log('Procesando líneas de entrenamiento:', entrenamientoLines);

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
        console.log('Guardando nueva configuración de entrenamiento:', nuevasComidasEntrenamiento);
        localStorage.setItem('comidasEntrenamiento', JSON.stringify(nuevasComidasEntrenamiento));

        // Actualizar la referencia en memoria
        comidasEntrenamiento.length = 0; // Vaciar el array
        nuevasComidasEntrenamiento.forEach(c => comidasEntrenamiento.push(c));

        console.log('Configuración de entrenamiento actualizada en memoria:', comidasEntrenamiento);
      }
    }

    // Para días sin entrenamiento
    if (noEntrenamientoLines.length) {
      console.log('Procesando líneas sin entrenamiento:', noEntrenamientoLines);

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
        console.log('Guardando nueva configuración sin entrenamiento:', nuevasComidasNoEntrenamiento);
        localStorage.setItem('comidasNoEntrenamiento', JSON.stringify(nuevasComidasNoEntrenamiento));

        // Actualizar la referencia en memoria
        comidasNoEntrenamiento.length = 0; // Vaciar el array
        nuevasComidasNoEntrenamiento.forEach(c => comidasNoEntrenamiento.push(c));

        console.log('Configuración sin entrenamiento actualizada en memoria:', comidasNoEntrenamiento);
      }
    }

    // Recargar todos los datos necesarios
    cargarComidas();
    cargarHistorial();

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

  console.log('Configuración de comidas cargada:', {
    entrenamiento: comidasEntrenamiento.length,
    noEntrenamiento: comidasNoEntrenamiento.length
  });
}

// — Datos y lógica core de la app —

// Variable global para seguir la pestaña activa
let tabActual = 'principal';

// 🧠 Aquí están todas las opciones para los dropdowns agrupadas por tipo
const opciones = {
  proteinas_desayuno_merienda: [
    "Vaso de leche (250cc)",
    "Vaso de yogur (200cc)",
    "Porción de queso (70gr)",
    "Fetas de queso (4u)",
    "Fetas de jamon (4u)",
    "Queso untable (2 cdas)",
    "Huevo entero (3u)"
  ],
  proteinas_desayuno_merienda_no_entrenamiento: [
    "Vaso de leche (250cc)",
    "Vaso de yogur (200cc)",
    "Porción de queso (70gr)",
    "Fetas de queso (4u)",
    "Queso untable (2 cdas)",
    "Huevo entero (3u)"
  ],
  hidratos_desayuno_merienda: [
    "Pan lactal integral (4u)",
    "Pan de mesa (8u)",
    "Tostada de arroz (6u)",
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
  colaciones: [
    "Fruta",
    "Gelatina",
    "Torta de avena",
    "Yogur (120gr)",
    "Barras de cereal",
    "Muttant Mass",
  ],
  grasas: [
    "4 nueces",
    "Pasta de maní",
    "½ palta"
  ],
  // Opciones separadas para almuerzo y cena
  proteinas_almuerzo_entrenamiento: [
    "Huevo entero (3u)",
    "Porción de queso PortSalut (80gr)",
    "Ricota (80gr)",
    "Lomo (200g)",
    "Solomillo (200g)",
    "Peceto (200g)",
    "Bola de Lomo(200g)",
    "Cuadril (200g)",
    "Nalga(200g)",
    "Pollo (200g)",
    "Pavo (200g)"
  ],
  hidratos_almuerzo_entrenamiento: [
    "Legumbre (200gr)",
    "Arroz (220gr cocido)",
    "Quinoa (??)",
    "Trigo (??)",
  ],
  proteinas_almuerzo_no_entrenamiento: [
    "Huevo entero (3u)",
    "Porción de queso PortSalut (80gr)",
    "Ricota (80gr)",
    "Lomo (200g)",
    "Solomillo (200g)",
    "Peceto (200g)",
    "Bola de Lomo(200g)",
    "Cuadril (200g)",
    "Nalga (200g)",
    "Pollo (200g)",
    "Pavo (200g)"
  ],
  hidratos_almuerzo_no_entrenamiento: [
    "Papa (2u med.)",
    "Camote (2u med.)",
    "Legumbres (200gr)",
    "Choclo (??)"
  ],
  vegetales_almuerzo_no_entrenamiento: [
    "SI",
    "NO",
  ],
  proteinas_cena: [
    "Huevo entero (3u)",
    "Ricota (80gr)",
    "Queso PortSalut (80gr)",
    "Solomillo (200g)",
    "Pollo (200g)",
    "Pavo (200g)",
    "Abadejo (200g)",
    "atún (200g)",
    "merluza (200g)",
    "salmón (200g)",
    "trucha (200g)",
  ],
  hidratos_cena: [
    "Papa (2u med.)",
    "Camote (2u med.)",
    "Legumbres (200gr)",
    "Choclo (??)"
  ],
  vegetales_cena: [
    "SI",
    "NO",
  ],
  suplementos: [
    "Creatina",
    "Proteína",
    "Muttant Mass (Scoop 1)",
    "Muttant Mass (Scoop 2)"
  ],
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
    nombre: "Desayuno",  // nombre visible en pantalla
    tipo: "desayuno_merienda",          // clave que determina qué grupo de opciones se usa ("desayuno_merienda")
    grupos: [
      "proteinas",       // primer dropdown de proteínas
      "proteinas",       // segundo dropdown de proteínas (agregado nuevo)
      "hidratos",
      "frutas",
      "grasas"
    ]
  },
  {
    nombre: "Almuerzo",
    tipo: "almuerzo_entrenamiento",
    grupos: ["proteinas", "hidratos"]
  },
  {
    nombre: "Merienda",
    tipo: "desayuno_merienda",
    grupos: [
      "proteinas",       // primer dropdown de proteínas
      "proteinas",       // segundo dropdown de proteínas (agregado nuevo)
      "hidratos",
      "frutas"
    ]
  },
  {
    nombre: "Cena",
    tipo: "cena",
    grupos: ["proteinas", "hidratos", "vegetales"]
  },
  {
    nombre: "Colación",
    tipo: null,
    grupos: ["colaciones"]
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
    tipo: "cena",
    grupos: ["proteinas", "hidratos", "vegetales"]
  },
  {
    nombre: "Colación",
    tipo: null,
    grupos: ["colaciones"]
  }
];

// 🔄 Recuperar opciones actuales desde localStorage (si existen)
function getOpciones() {
  const saved = JSON.parse(localStorage.getItem('opcionesDropdowns') || 'null');
  return saved || JSON.parse(JSON.stringify(opciones));
}

// 💾 Guardar opciones personalizadas al localStorage
function setOpciones(newOpc) {
  localStorage.setItem('opcionesDropdowns', JSON.stringify(newOpc));
}

// 🛠️ Crear un selector <select> para un grupo dado (ej: proteinas, hidratos...)
function crearSelector(grupo, idx, tipo, selected = null) {
  const select = document.createElement('select');
  select.id = `select-${grupo}-${tipo || 'col'}-${idx}`;

  let key;
  if (tipo === "almuerzo_entrenamiento") {
    key = `${grupo}_almuerzo_entrenamiento`;
  } else if (tipo === "almuerzo_no_entrenamiento") {
    key = `${grupo}_almuerzo_no_entrenamiento`;
  } else if (tipo === "cena") {
    key = `${grupo}_cena`;
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
  checkboxContainer.style.display = 'flex';
  checkboxContainer.style.flexWrap = 'wrap';
  checkboxContainer.style.gap = '10px';
  checkboxContainer.style.marginTop = '10px';

  getOpciones().suplementos.forEach(sup => {
    const label = document.createElement('label');
    label.style.display = 'flex';
    label.style.alignItems = 'center';
    label.style.padding = '8px 12px';
    label.style.backgroundColor = tomados.includes(sup) ? '#4CAF5033' : '#f9f9f9';
    label.style.borderRadius = '5px';
    label.style.cursor = 'pointer';
    label.style.transition = 'background-color 0.3s';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = tomados.includes(sup);
    cb.style.marginRight = '8px';
    cb.onchange = () => {
      const m = JSON.parse(localStorage.getItem('suplementosPorDia') || '{}');
      const arr = m[key] || [];
      if (cb.checked) {
        arr.push(sup);
        label.style.backgroundColor = '#4CAF5033';
      } else {
        const i = arr.indexOf(sup);
        if (i >= 0) arr.splice(i, 1);
        label.style.backgroundColor = '#f9f9f9';
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

    // Agregar encabezado de la comida con estado
    const comidaHeader = document.createElement('div');
    comidaHeader.style.display = 'flex';
    comidaHeader.style.justifyContent = 'space-between';
    comidaHeader.style.alignItems = 'center';
    comidaHeader.style.marginBottom = '12px';

    const titulo = document.createElement('div');
    titulo.className = 'comida-titulo';
    titulo.textContent = c.nombre;

    const done = hist.some(x => {
      const d = x.fecha.split(',')[0].split(' ')[0].trim();
      return d === today && x.nombre === c.nombre;
    });

    comidaHeader.appendChild(titulo);
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
      grupoDiv.className = 'grupo-dropdown';

      // Mostrar el nombre completo del grupo
      const base = g.split('_')[0]; // Para obtener el icono correspondiente
      const labelGrupo = g.replace(/_/g, ' ').toUpperCase();
      const icono = iconos[base] || '';

      const label = document.createElement('label');
      label.innerHTML = `${icono} ${labelGrupo}`;

      const selector = crearSelector(g, i, c.tipo);
      if (done) {
        selector.disabled = true; // Desactiva si ya está marcada
        selector.style.opacity = '0.7';
      }

      grupoDiv.appendChild(label);
      grupoDiv.appendChild(selector);
      li.appendChild(grupoDiv);
    });

    // Botón para marcar comida como completada
    const btnContainer = document.createElement('div');
    btnContainer.style.marginTop = '15px';
    btnContainer.style.textAlign = 'right';

    const btn = document.createElement('button');
    if (done) {
      btn.textContent = '✓ Completada';
      btn.className = 'btn-secondary';
      btn.disabled = true;

      // Agregar badge de completado
      const badge = document.createElement('span');
      badge.textContent = '✓ Completada';
      badge.style.position = 'absolute';
      badge.style.top = '10px';
      badge.style.right = '10px';
      badge.style.backgroundColor = '#4CAF50';
      badge.style.color = 'white';
      badge.style.padding = '3px 8px';
      badge.style.borderRadius = '12px';
      badge.style.fontSize = '0.8rem';
      comidaHeader.appendChild(badge);
    } else {
      btn.textContent = 'Marcar como completada';
      btn.className = 'btn-completar';
      btn.onclick = () => marcarComida(i);
    }

    btnContainer.appendChild(btn);
    li.appendChild(btnContainer);

    // Si está completada, agregar clase para estilo visual
    if (done) {
      li.classList.add('comida-completada');
      li.style.borderLeft = '5px solid #4CAF50';
    } else {
      li.style.borderLeft = '5px solid #FFC107';
    }

    ul.appendChild(li);
  });
}

// ✅ Guardar selección de una comida en el historial
function marcarComida(i) {
  const fecha = new Date().toLocaleString();
  const tipoDia = document.getElementById('tipo-dia-select')?.value || 'entrenamiento';
  const comidasList = tipoDia === 'entrenamiento' ? comidasEntrenamiento : comidasNoEntrenamiento;
  const c = comidasList[i];

  const sel = c.grupos.map(g => {
    const s = document.getElementById(`select-${g}-${c.tipo || 'col'}-${i}`);
    return `${g}: ${s.value}`;
  }).join(', ');

  const h = JSON.parse(localStorage.getItem('historialComidas') || '[]');
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
  const base = g.split('_')[0];
  const labelGrupo = g.replace(/_/g, ' ').toUpperCase();
  const icono = iconos[base] || '';
  lbl.innerHTML = `<span style="display:inline-block; min-width:200px">${icono} ${labelGrupo}</span>`;
  lbl.appendChild(crearSelector(g, idx, tipo, currentMap[g]));
  lbl.style.marginBottom = '0.5em';
  lbl.style.flexDirection = 'column';
  lbl.style.alignItems = 'flex-start';
  form.appendChild(lbl);
});

  const btnSave = document.createElement('button');
  btnSave.textContent = 'Guardar';
  btnSave.onclick = () => {
    entry.seleccion = grupos.map(gp => {
      const s = document.getElementById(`select-${gp}-${tipo || 'col'}-${idx}`);
      return `${gp}: ${s.value}`;
    }).join(', ');
    h[idx] = entry;
    localStorage.setItem('historialComidas', JSON.stringify(h));
    cargarHistorial();
  };
  const btnCancel = document.createElement('button');
  btnCancel.textContent = 'Cancelar';
  btnCancel.style.marginLeft = '0.5em';
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
  const dias = {};

  // Agrupar por fecha
  h.forEach((item, idx) => {
    const d = item.fecha.split(',')[0].split(' ')[0].trim();
    if (!dias[d]) dias[d] = [];
    dias[d].push({ item, idx });
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

    // Obtener datos de agua y suplementos
    const wc = JSON.parse(localStorage.getItem('waterCounts') || '{}')[fecha] || 0;
    const sup = (JSON.parse(localStorage.getItem('suplementosPorDia') || '{}')[fecha] || []);

    // Crear cabecera del día con iconos
    const dateHeader = document.createElement('div');
    dateHeader.style.display = 'flex';
    dateHeader.style.alignItems = 'center';

    const dateText = document.createElement('span');
    dateText.innerHTML = `<strong>${fecha}</strong> <span class="toggle-icon">▼</span>`;
    dateText.style.flex = '1';

    const badgesContainer = document.createElement('div');
    badgesContainer.style.display = 'flex';
    badgesContainer.style.gap = '10px';
    badgesContainer.style.alignItems = 'center';

    // Badge de agua
    const waterBadge = document.createElement('span');
    waterBadge.innerHTML = `💧 ${wc}`;
    waterBadge.style.backgroundColor = '#E1F5FE';
    waterBadge.style.color = '#0288D1';
    waterBadge.style.padding = '3px 8px';
    waterBadge.style.borderRadius = '12px';
    waterBadge.style.fontSize = '0.85rem';
    badgesContainer.appendChild(waterBadge);

    // Badges de suplementos (si hay)
    if (sup.length > 0) {
      const supBadge = document.createElement('span');
      supBadge.innerHTML = `💊 ${sup.length}`;
      supBadge.title = sup.join(', ');
      supBadge.style.backgroundColor = '#F3E5F5';
      supBadge.style.color = '#7B1FA2';
      supBadge.style.padding = '3px 8px';
      supBadge.style.borderRadius = '12px';
      supBadge.style.fontSize = '0.85rem';
      badgesContainer.appendChild(supBadge);
    }

    dateHeader.appendChild(dateText);
    dateHeader.appendChild(badgesContainer);
    li.appendChild(dateHeader);

    ul.appendChild(li);

    // Lista de comidas del día
    const inner = document.createElement('ul');
    inner.style.margin = '0';
    inner.style.padding = '0';

    dias[fecha].forEach(({ item, idx }) => {
      const li2 = document.createElement('li');

      // Crear estructura para la comida en el historial
      const comidaContainer = document.createElement('div');
      comidaContainer.style.padding = '15px';

      // Cabecera con el nombre de la comida y botón de editar
      const comidaHeader = document.createElement('div');
      comidaHeader.style.display = 'flex';
      comidaHeader.style.justifyContent = 'space-between';
      comidaHeader.style.alignItems = 'center';
      comidaHeader.style.marginBottom = '8px';

      const nombreComida = document.createElement('span');
      nombreComida.className = 'historial-item-nombre';
      nombreComida.textContent = item.nombre;

      const btnEdit = document.createElement('button');
      btnEdit.innerHTML = '✏️ Editar';
      btnEdit.onclick = () => editarHistorial(idx, li2);

      comidaHeader.appendChild(nombreComida);
      comidaHeader.appendChild(btnEdit);
      comidaContainer.appendChild(comidaHeader);

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
      detallesContainer.style.display = 'flex';
      detallesContainer.style.flexDirection = 'column';
      detallesContainer.style.gap = '5px';

      const partes = item.seleccion.split(', ').map(pair => {
        const [grupo, valor] = pair.split(': ');
        const g = grupo.replace(/_/g, ' ').toUpperCase();
        const base = grupo.split('_')[0]; // para proteinas_desayuno_merienda => proteinas
        const icono = iconos[base] || '';

        const detalleFila = document.createElement('div');
        detalleFila.style.display = 'flex';
        detalleFila.style.alignItems = 'center';

        const labelGrupo = document.createElement('span');
        // Mostrar el nombre completo del grupo
        const nombreCompleto = grupo.replace(/_/g, ' ').toUpperCase();
        labelGrupo.innerHTML = `${icono} ${nombreCompleto}`;
        labelGrupo.style.width = '240px';
        labelGrupo.style.fontWeight = '500';

        const valorSpan = document.createElement('span');
        valorSpan.textContent = valor;
        valorSpan.style.color = '#555';

        detalleFila.appendChild(labelGrupo);
        detalleFila.appendChild(valorSpan);
        return detalleFila;
      });

      partes.forEach(detalle => detallesContainer.appendChild(detalle));
      spanSel.appendChild(detallesContainer);
      comidaContainer.appendChild(spanSel);

      li2.appendChild(comidaContainer);
      inner.appendChild(li2);
    });

    ul.appendChild(inner);

    // Manejo de expansión/colapso
    let open = true;
    const toggleIcon = li.querySelector('.toggle-icon');

    li.onclick = (e) => {
      open = !open;
      inner.style.display = open ? '' : 'none';
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


// Función para modificar los grupos de comidas (añadir/quitar dropdowns)
function modificarGruposComida(comidaNombre, tipoComida, grupo, accion) {
  const lista = tipoComida === 'entrenamiento' ? comidasEntrenamiento : comidasNoEntrenamiento;
  const comida = lista.find(c => c.nombre === comidaNombre);

  if (!comida) return false;

  // Para añadir un grupo
  if (accion === 'agregar') {
    comida.grupos.push(grupo);
    console.log(`Grupo ${grupo} agregado a ${comidaNombre}`);
  }
  // Para quitar un grupo
  else if (accion === 'quitar') {
    const index = comida.grupos.indexOf(grupo);
    if (index > -1) {
      comida.grupos.splice(index, 1);
      console.log(`Grupo ${grupo} eliminado de ${comidaNombre}`);
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
  console.log('Renderizando formulario de opciones con configuración actualizada');
  const cont = document.getElementById('opciones-form');
  if (!cont) {
    console.warn('Elemento opciones-form no encontrado en el DOM');
    return; // Salir si no encontramos el contenedor
  }
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
    console.log(`Mostrando configuración para días de ${tipoDia}`);

    // Actualizar botones activos
    document.querySelectorAll('.config-tab').forEach(b => b.classList.remove('active'));
    if (tipoDia === 'entrenamiento') {
      btnEntrenamiento.classList.add('active');
    } else {
      btnNoEntrenamiento.classList.add('active');
    }

    // Usar las referencias en memoria actualizadas
    const lista = tipoDia === 'entrenamiento' ? comidasEntrenamiento : comidasNoEntrenamiento;
    console.log(`Configuración actual de ${tipoDia}:`, lista);

    configComidasDiv.innerHTML = '';

    // Listar cada comida con sus grupos
    lista.forEach(comida => {
      const comidaDiv = document.createElement('div');
      comidaDiv.className = 'comida-grupos';

      // Encabezado de la comida con estilo mejorado
      const comidaHeader = document.createElement('div');
      comidaHeader.style.display = 'flex';
      comidaHeader.style.alignItems = 'center';
      comidaHeader.style.justifyContent = 'space-between';
      comidaHeader.style.marginBottom = '12px';
      comidaHeader.style.paddingBottom = '8px';
      comidaHeader.style.borderBottom = '1px solid #e0e0e0';

      const h4 = document.createElement('h4');
      h4.textContent = comida.nombre;
      h4.style.margin = '0';
      h4.style.color = '#388E3C';

      // Contador de grupos
      const grupoCount = document.createElement('span');
      grupoCount.textContent = `${comida.grupos.length} grupo(s)`;
      grupoCount.style.fontSize = '0.85rem';
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
      grupoCount.style.color = '#757575';

      comidaHeader.appendChild(h4);
      comidaHeader.appendChild(grupoCount);
      comidaDiv.appendChild(comidaHeader);

      // Listar los grupos actuales con estilo mejorado
      if (comida.grupos.length > 0) {
        const gruposContainer = document.createElement('div');
        gruposContainer.style.marginBottom = '15px';

        comida.grupos.forEach((grupo, grupoIdx) => {
          const grupoItem = document.createElement('div');
          grupoItem.style.display = 'flex';
          grupoItem.style.alignItems = 'center';
          grupoItem.style.justifyContent = 'space-between';
          grupoItem.style.padding = '8px 10px';
          grupoItem.style.marginBottom = '5px';
          grupoItem.style.backgroundColor = '#f5f5f5';
          grupoItem.style.borderRadius = '4px';
          grupoItem.style.borderLeft = '3px solid #4CAF50';

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
          btnQuitar.className = 'btn-delete';
          btnQuitar.innerHTML = '✖';
          btnQuitar.title = 'Quitar este grupo';
          btnQuitar.style.minWidth = 'unset';
          btnQuitar.style.width = '30px';
          btnQuitar.style.height = '30px';
          btnQuitar.style.padding = '0';
          btnQuitar.style.display = 'flex';
          btnQuitar.style.justifyContent = 'center';
          btnQuitar.style.alignItems = 'center';
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
        emptyMessage.style.color = '#757575';
        emptyMessage.style.fontStyle = 'italic';
        comidaDiv.appendChild(emptyMessage);
      }

      // Selector para añadir grupos con mejor estilo
      const addGroupDiv = document.createElement('div');
      addGroupDiv.style.display = 'flex';
      addGroupDiv.style.alignItems = 'center';
      addGroupDiv.style.marginTop = '10px';
      addGroupDiv.style.flexWrap = 'wrap';
      addGroupDiv.style.width = '100%';
      addGroupDiv.style.boxSizing = 'border-box';
      addGroupDiv.style.gap = '8px';

      const select = document.createElement('select');
      select.id = `select-add-grupo-${comida.nombre}-${tipoDia}`;
      select.style.flex = '1 1 200px';
      select.style.minWidth = '0';
      select.style.maxWidth = '100%';
      select.style.padding = '8px 12px';
      select.style.borderRadius = '4px';
      select.style.border = '1px solid #ddd';
      select.style.boxSizing = 'border-box';

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
      btnAdd.className = 'btn-outline';
      btnAdd.innerHTML = '➕ Agregar';
      btnAdd.style.flex = '0 0 auto';
      btnAdd.style.minWidth = '80px';
      btnAdd.style.maxWidth = 'none';
      btnAdd.style.boxSizing = 'border-box';
      btnAdd.style.whiteSpace = 'nowrap';
      btnAdd.style.padding = '8px 12px';
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
  separator.style.margin = '30px 0';
  separator.style.borderTop = '1px solid #e0e0e0';
  cont.appendChild(separator);

  // Título para la sección de alimentos
  const tituloAlimentos = document.createElement('h3');
  tituloAlimentos.textContent = 'Configuración de Alimentos';
  tituloAlimentos.style.marginBottom = '20px';
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
        li.style.fontStyle = 'italic';
        li.style.color = '#757575';
        li.style.borderBottom = 'none';
        ul.appendChild(li);
      } else {
        current[grupoKey].forEach((opt, idx) => {
          const li = document.createElement('li');

          const optionText = document.createElement('span');
          optionText.textContent = opt;

          const btnDel = document.createElement('button');
          btnDel.innerHTML = '✖';
          btnDel.className = 'btn-delete';
          btnDel.style.minWidth = 'unset';
          btnDel.style.width = '30px';
          btnDel.style.height = '30px';
          btnDel.style.padding = '0';
          btnDel.title = 'Eliminar este alimento';

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
    addForm.style.display = 'flex';
    addForm.style.marginTop = '15px';

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = `Nuevo alimento...`;
    inp.style.flex = '1';

    const btnAdd = document.createElement('button');
    btnAdd.textContent = 'Agregar';
    btnAdd.style.marginLeft = '10px';

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

  // Agua
  const key = getTodayKey();
  let cnt = getWaterCount(key);
  const span = document.getElementById('water-count');
  span.textContent = cnt;
  document.getElementById('add-water').onclick = () => {
    cnt++;
    span.textContent = cnt;
    setWaterCount(key, cnt);
    cargarHistorial();
  };
  document.getElementById('reset-water').onclick = () => {
    cnt = 0;
    span.textContent = cnt;
    setWaterCount(key, cnt);
    cargarHistorial();
  };

  // Tabs
  function showTab(tab) {
    document.querySelectorAll('.tab-content').forEach(s => s.style.display = 'none');
    document.getElementById('tab-content-' + tab).style.display = '';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    // Actualizar variable global de pestaña actual
    tabActual = tab;
    console.log('Cambio de pestaña a:', tabActual);
  }
  document.getElementById('tab-principal').onclick = () => showTab('principal');
  document.getElementById('tab-historial').onclick = () => showTab('historial');
  document.getElementById('tab-opciones').onclick = () => showTab('opciones');
  document.getElementById('tab-ayuda').onclick = () => showTab('ayuda');

  showTab('principal');

  renderOpcionesForm();
});

  document.getElementById('reiniciar-app').onclick = () => {
    if (confirm('¿Querés reiniciar la app? Se eliminarán todos los datos y se restaurarán las opciones por defecto.')) {
      localStorage.clear();
      alert('App reiniciada. Se restauró la configuración original.');
      location.reload();
    }
  };

// — Registrar Service Worker —
if ('serviceWorker' in navigator) {
  // Usar una ruta relativa para que funcione en GitHub Pages
  const swPath = new URL('service-worker.js', window.location.href).pathname;
  navigator.serviceWorker.register(swPath)
    .then(reg => console.log('SW registrado', reg))
    .catch(err => console.error('SW fallo', err));
}
