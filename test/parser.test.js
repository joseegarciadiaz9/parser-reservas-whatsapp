const assert = require('assert');
const { parsearReserva } = require('../src/parser');

// Formulario real recibido el 11/08/2026 (captura del grupo RESERVADOS LIVE 2026).
const FORMULARIO_REAL = `LIVE Punta Umbría
Formulario de reserva
Copie, pegue y rellene estos datos por favor

Fecha: 15/08/2026
Un nombre y apellidos: miguel reja nieto
Nº de personas: 6
Teléfono: 638828985
Correo Electrónico: mrejanieto@gmail.com
Zona preferida: ría
Hora de llegada: 23:30
Nº de botellas: 2 (1de lario y 1de ron barcelo)
Edades del grupo (detallado): 23,24,23,26,27,22

LAS RESERVAS SERÁN CONFIRMADAS POR EL PROPIO CLIENTE AL ABONAR EL PREPAGO
Recibirá un sms para ello y un QR al correo que deberá mostrar en puerta.`;

// 1. Caso feliz: el formulario real se parsea entero.
{
  const r = parsearReserva(FORMULARIO_REAL);
  assert.strictEqual(r.esReserva, true, 'debe detectarse como reserva');
  assert.strictEqual(r.datos.fecha, '15/08/2026');
  assert.strictEqual(r.datos.nombre, 'miguel reja nieto');
  assert.strictEqual(r.datos.personas, 6);
  assert.strictEqual(r.datos.telefono, '+34638828985');
  assert.strictEqual(r.datos.email, 'mrejanieto@gmail.com');
  assert.strictEqual(r.datos.zona, 'ría');
  assert.strictEqual(r.datos.hora, '23:30');
  assert.strictEqual(r.datos.botellas, 2);
  assert.deepStrictEqual(r.datos.edades, [23, 24, 23, 26, 27, 22]);
  assert.deepStrictEqual(r.faltan, []);
  // 6 personas con 2 botellas = justo el límite de 3 pax/botella, sin aviso.
  assert.deepStrictEqual(r.avisos, []);
  console.log('✓ formulario real completo');
}

// 2. El bloque legal del final no debe contaminar el último campo.
{
  const r = parsearReserva(FORMULARIO_REAL);
  assert.ok(!/RESERVAS/i.test(String(r.datos.edades)), 'edades limpias');
  console.log('✓ corta en el bloque legal');
}

// 3. Cliente descuidado: sin tildes, sin "º", nombre partido en dos líneas.
{
  const r = parsearReserva(`Fecha: 22/8/26
Un nombre y apellidos: Ana
Lopez Ruiz
N de personas: 4
Telefono: 611 22 33 44
Correo electronico: ana@mail.com
Zona preferida: pista
Hora de llegada: 00:30
N de botellas: 1
Edades: 20, 21, 22, 25`);
  assert.strictEqual(r.esReserva, true);
  assert.strictEqual(r.datos.nombre, 'Ana Lopez Ruiz', 'une la línea de continuación');
  assert.strictEqual(r.datos.telefono, '+34611223344');
  assert.strictEqual(r.datos.personas, 4);
  // 4 personas y 1 botella supera 3 pax/botella -> debe avisar.
  assert.ok(r.avisos.some((a) => a.includes('3 pax/botella')), 'avisa del exceso');
  console.log('✓ formulario descuidado + aviso de aforo por botella');
}

// 4. Formulario incompleto: detecta reserva pero lista lo que falta.
{
  const r = parsearReserva(`Fecha: 30/08/2026
Un nombre y apellidos: Carlos
Nº de personas: 8
Teléfono:
Zona preferida:
Hora de llegada: 23:45`);
  assert.strictEqual(r.esReserva, true);
  assert.ok(r.faltan.includes('telefono'), 'falta teléfono');
  assert.ok(r.faltan.includes('zona'), 'falta zona');
  console.log('✓ detecta campos incompletos');
}

// 5. Menores en el grupo -> aviso para puerta.
{
  const r = parsearReserva(`Fecha: 15/08/2026
Un nombre y apellidos: Luis Gomez
Nº de personas: 3
Teléfono: 600111222
Zona preferida: pista
Hora de llegada: 23:30
Nº de botellas: 1
Edades del grupo (detallado): 17,19,20`);
  assert.ok(r.avisos.some((a) => a.includes('menores')), 'avisa de menores');
  console.log('✓ avisa de menores de 18');
}

// 6. Descuadre entre nº de personas y edades declaradas.
{
  const r = parsearReserva(`Fecha: 15/08/2026
Un nombre y apellidos: Sara Diaz
Nº de personas: 6
Teléfono: 600111222
Zona preferida: tarima
Hora de llegada: 23:30
Nº de botellas: 2
Edades del grupo (detallado): 23,24`);
  assert.ok(r.avisos.some((a) => a.includes('6 personas')), 'avisa del descuadre');
  console.log('✓ detecta descuadre personas/edades');
}

// 7. Mensajes normales NO deben confundirse con una reserva.
{
  for (const mensaje of [
    'hola, a que hora abris el sabado?',
    'queremos coger reservado para el sábado',
    'somos 6',
    'Hora de llegada: 23:30',
    '',
  ]) {
    const r = parsearReserva(mensaje);
    assert.strictEqual(r.esReserva, false, `falso positivo con: "${mensaje}"`);
  }
  console.log('✓ sin falsos positivos en mensajes sueltos');
}

console.log('\nTodos los tests pasan.');
