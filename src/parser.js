/**
 * Detecta y parsea el formulario de reserva de LIVE Punta Umbría.
 *
 * Los clientes copian, pegan y rellenan la plantilla, así que el texto que llega
 * es irregular: tildes que faltan, "Nº" escrito como "N", campos vacíos, líneas
 * en desorden y valores que ocupan varias líneas. El parser tolera todo eso.
 */

const CAMPOS = [
  { clave: 'fecha', etiquetas: ['fecha'] },
  { clave: 'nombre', etiquetas: ['un nombre y apellidos', 'nombre y apellidos', 'nombre'] },
  { clave: 'personas', etiquetas: ['n de personas', 'no de personas', 'numero de personas', 'personas'] },
  { clave: 'telefono', etiquetas: ['telefono'] },
  { clave: 'email', etiquetas: ['correo electronico', 'correo', 'email', 'e mail'] },
  { clave: 'zona', etiquetas: ['zona preferida', 'zona'] },
  { clave: 'hora', etiquetas: ['hora de llegada', 'hora'] },
  { clave: 'botellas', etiquetas: ['n de botellas', 'no de botellas', 'numero de botellas', 'botellas'] },
  { clave: 'edades', etiquetas: ['edades del grupo detallado', 'edades del grupo', 'edades'] },
];

/** Minúsculas y sin tildes, para comparar etiquetas sin depender de cómo las escriban. */
function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Busca a qué campo corresponde una etiqueta. Prioriza la coincidencia más larga
 * para que "n de botellas" no se lo quede el campo genérico "botellas".
 */
function identificarCampo(etiquetaCruda) {
  const etiqueta = normalizar(etiquetaCruda);
  if (!etiqueta) return null;

  let mejor = null;
  for (const campo of CAMPOS) {
    for (const candidata of campo.etiquetas) {
      if (etiqueta === candidata || etiqueta.endsWith(' ' + candidata)) {
        if (!mejor || candidata.length > mejor.longitud) {
          mejor = { clave: campo.clave, longitud: candidata.length };
        }
      }
    }
  }
  return mejor && mejor.clave;
}

/**
 * Extrae los campos del formulario.
 * Devuelve { campos, encontrados } sin juzgar todavía si es una reserva válida.
 */
function extraerCampos(texto) {
  const campos = {};
  let campoActual = null;

  for (const linea of texto.split('\n')) {
    const separador = linea.indexOf(':');

    if (separador !== -1) {
      const clave = identificarCampo(linea.slice(0, separador));
      if (clave) {
        campoActual = clave;
        campos[clave] = linea.slice(separador + 1).trim();
        continue;
      }
    }

    // Línea sin etiqueta: es la continuación del campo anterior (nombres largos,
    // listas de edades que se parten). Solo si ese campo aún está vacío o abierto.
    if (campoActual && linea.trim()) {
      const cola = normalizar(linea);
      // Cortamos al llegar al bloque legal del final de la plantilla.
      if (cola.startsWith('las reservas seran confirmadas')) break;
      campos[campoActual] = (campos[campoActual] + ' ' + linea.trim()).trim();
    }
  }

  return campos;
}

/** Normaliza un teléfono español a formato E.164 cuando es reconocible. */
function normalizarTelefono(valor) {
  if (!valor) return null;
  const digitos = valor.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  if (digitos.startsWith('+')) return digitos;
  if (digitos.length === 9 && /^[6789]/.test(digitos)) return '+34' + digitos;
  if (digitos.length === 11 && digitos.startsWith('34')) return '+' + digitos;
  return digitos || null;
}

/** Extrae el primer entero de un texto libre ("2 (1 de lario y 1 de ron)" -> 2). */
function primerEntero(valor) {
  if (!valor) return null;
  const m = valor.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

/** Convierte "23,24,23,26,27,22" en array de números. */
function parsearEdades(valor) {
  if (!valor) return [];
  return (valor.match(/\d{1,2}/g) || [])
    .map(Number)
    .filter((edad) => edad >= 14 && edad <= 99);
}

/**
 * Punto de entrada. Analiza un mensaje entrante de WhatsApp.
 *
 * @returns {{esReserva: boolean, confianza: number, datos: object, faltan: string[], avisos: string[]}}
 */
function parsearReserva(texto) {
  if (!texto || typeof texto !== 'string') {
    return { esReserva: false, confianza: 0, datos: {}, faltan: [], avisos: [] };
  }

  const campos = extraerCampos(texto);
  const rellenos = Object.entries(campos).filter(([, v]) => v);

  // Umbral: al menos 4 campos con contenido. Menos que eso suele ser alguien
  // preguntando por un dato suelto, no enviando el formulario.
  const confianza = rellenos.length / CAMPOS.length;
  const esReserva = rellenos.length >= 4;

  const datos = {
    fecha: campos.fecha || null,
    nombre: campos.nombre || null,
    personas: primerEntero(campos.personas),
    telefono: normalizarTelefono(campos.telefono),
    email: (campos.email || '').trim().toLowerCase() || null,
    zona: campos.zona || null,
    hora: campos.hora || null,
    botellas: primerEntero(campos.botellas),
    botellasDetalle: campos.botellas || null,
    edades: parsearEdades(campos.edades),
  };

  const obligatorios = ['fecha', 'nombre', 'personas', 'telefono', 'zona', 'hora'];
  const faltan = obligatorios.filter((c) => datos[c] === null || datos[c] === '');

  const avisos = [];
  if (datos.personas && datos.edades.length && datos.edades.length !== datos.personas) {
    avisos.push(
      `Ha indicado ${datos.personas} personas pero ${datos.edades.length} edades.`
    );
  }
  if (datos.edades.some((edad) => edad < 18)) {
    avisos.push('Hay menores de 18 en el grupo.');
  }
  if (datos.personas && datos.botellas) {
    // Condición del cartel: máximo 3 personas por botella.
    const capacidad = datos.botellas * 3;
    if (datos.personas > capacidad) {
      avisos.push(
        `${datos.personas} personas con ${datos.botellas} botella(s): supera el máx. de 3 pax/botella (${capacidad}). Aplicaría suplemento por persona extra.`
      );
    }
  }

  return { esReserva, confianza, datos, faltan, avisos };
}

module.exports = { parsearReserva, normalizarTelefono, parsearEdades };
