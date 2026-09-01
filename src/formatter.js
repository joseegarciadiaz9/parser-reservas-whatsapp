/**
 * Convierte una reserva parseada en el mensaje que recibe el equipo.
 *
 * Sustituye al reenvío manual que se hace hoy al grupo RESERVADOS LIVE 2026,
 * añadiendo lo que un reenvío no da: avisos automáticos y campos que faltan.
 */

const ETIQUETAS_ZONA = {
  pista: 'Pista',
  'front stage': 'Front Stage',
  frontstage: 'Front Stage',
  ria: 'Tarima Ría',
  'tarima ria': 'Tarima Ría',
  tarima: 'Tarima Ría',
  palco: 'Palco (confirmar cuál)',
};

function normalizarZona(zona) {
  if (!zona) return null;
  const clave = zona
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
  return ETIQUETAS_ZONA[clave] || zona.trim();
}

/** Marca las llegadas que activan suplemento por botella (cartel VIE-SAB). */
function analizarHora(hora) {
  if (!hora) return null;
  const m = hora.match(/(\d{1,2})[:.h]?(\d{2})?/);
  if (!m) return null;

  const h = parseInt(m[1], 10);
  // La madrugada (00:00-06:00) va "después" de la noche.
  const esMadrugada = h < 6;
  if (!esMadrugada) return { promo: h === 23, suplemento: 0 };
  if (h >= 1) return { promo: false, suplemento: 60 };
  return { promo: false, suplemento: 30 };
}

function formatearParaEquipo({ datos, faltan, avisos }, remitente) {
  const lineas = ['*NUEVA RESERVA — LIVE Punta Umbría*', ''];

  lineas.push(`*Fecha:* ${datos.fecha || '—'}`);
  lineas.push(`*Nombre:* ${datos.nombre || '—'}`);
  lineas.push(`*Personas:* ${datos.personas ?? '—'}`);
  lineas.push(`*Teléfono:* ${datos.telefono || '—'}`);
  if (datos.email) lineas.push(`*Correo:* ${datos.email}`);
  lineas.push(`*Zona:* ${normalizarZona(datos.zona) || '—'}`);
  lineas.push(`*Llegada:* ${datos.hora || '—'}`);
  lineas.push(`*Botellas:* ${datos.botellasDetalle || '—'}`);
  if (datos.edades.length) lineas.push(`*Edades:* ${datos.edades.join(', ')}`);

  const hora = analizarHora(datos.hora);
  if (hora?.suplemento) {
    lineas.push('', `_Llegada tardía: +${hora.suplemento} € por botella._`);
  } else if (hora?.promo) {
    lineas.push('', '_Entra en franja promo 23:00–00:00._');
  }

  if (avisos.length) {
    lineas.push('', '*⚠️ Revisar:*');
    avisos.forEach((a) => lineas.push(`• ${a}`));
  }

  if (faltan.length) {
    lineas.push('', `*Faltan datos:* ${faltan.join(', ')}`);
  }

  lineas.push('', `_Recibido de ${remitente || 'desconocido'}_`);
  lineas.push('_Siguiente paso: enviar SMS de prepago._');

  return lineas.join('\n');
}

module.exports = { formatearParaEquipo, normalizarZona, analizarHora };
