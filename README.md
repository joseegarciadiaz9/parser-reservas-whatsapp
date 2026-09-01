# Parser de reservas por WhatsApp

Parser y formateador que convierten un mensaje de WhatsApp escrito a mano en una reserva estructurada, lista para darla de alta en un sistema de ticketing.

## El problema

En un club de ocio nocturno las reservas de mesa llegan por WhatsApp. El cliente copia una plantilla, la rellena y la envía. Lo que llega al otro lado nunca es limpio:

- tildes que faltan y campos escritos de diez formas distintas (`Nº de personas`, `N personas`, `numero de personas`)
- líneas en desorden
- campos vacíos
- valores que ocupan varias líneas

El equipo de relaciones públicas leía cada mensaje y lo tecleaba a mano en el panel de reservas. Lento y con errores de transcripción en fin de semana, que es justo cuando no hay tiempo.

## Qué hace

`parser.js` normaliza el texto y extrae los nueve campos de la reserva (fecha, nombre, personas, teléfono, email, zona, hora de llegada, botellas y edades del grupo), tolerando las variantes de escritura reales que aparecen en los mensajes.

`formatter.js` deja el resultado en el formato que espera el sistema de reservas.

## Decisiones de diseño

**Etiquetas, no posiciones.** Cada campo se identifica por una lista de etiquetas equivalentes en vez de por el orden de las líneas, porque el orden no se respeta casi nunca.

**Normalización agresiva antes de comparar.** Se eliminan tildes y se baja a minúsculas, de modo que `Nº`, `N.º` y `N` acaben en el mismo sitio.

**Tolerar en vez de rechazar.** Un mensaje incompleto devuelve los campos que sí se entienden en lugar de fallar, porque un humano va a revisar el resultado de todas formas.

## Tests

```bash
node --test
```

La batería de pruebas usa mensajes reales anonimizados, incluidos los casos raros que fueron apareciendo en producción.

## Estado

Extraído de una herramienta interna en uso. Se publica solo el núcleo de parseo y formateo: la integración con las APIs del cliente y su configuración quedan fuera del repositorio.
