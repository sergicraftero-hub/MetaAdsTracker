# Prompt para crear la versión de Sanitas (a partir de BUT Calls)

Cómo usarlo:

1. Abre una sesión nueva de Claude Code con un repositorio vacío para la app de Sanitas.
2. Adjunta el archivo `but-calls-codigo.zip` (el código completo de BUT Calls). Si no se puede adjuntar, añade a la sesión el repositorio `sergicraftero-hub/metaadstracker`, rama `claude/optimistic-mayer-hlwajq`, solo para leerlo.
3. Rellena lo que va entre corchetes `[ ]`. Lo que no sepas, déjalo: Claude te lo preguntará.
4. Copia todo lo que hay debajo de la línea y pégalo como primer mensaje.

---

Quiero que construyas un CRM de seguimiento comercial para vender **Sanitas** (seguros de salud) por teléfono. Ya tenemos uno funcionando para vender O2, llamado BUT Calls, y quiero exactamente lo mismo adaptado a Sanitas.

**No empieces de cero.** Te adjunto el código completo de BUT Calls (`but-calls-codigo.zip`; si no está adjunto, está en el repositorio `sergicraftero-hub/metaadstracker`, rama `claude/optimistic-mayer-hlwajq`). Cópialo a este repositorio y adáptalo. Antes de tocar nada, léete:

- `README.md`: qué hace la app y cómo se despliega.
- `CLAUDE.md`: las reglas del proyecto. Cópialo y adáptalo a Sanitas; sigue valiendo todo.
- `src/components/Help.tsx`: en `MANUAL` está explicada cada regla de negocio con detalle.
- `PENDIENTES.md`: mejoras apuntadas y lo que el cliente descartó.
- `pruebas/README.md`: las pruebas automáticas.

Luego hazme un resumen de lo que has entendido y de lo que vas a cambiar, y espera mi visto bueno antes de programar.

## Lo que es nuevo y separado

La app de Sanitas es otra app. No comparte nada con BUT Calls:

- Repositorio, proyecto de Vercel y dirección web nuevos.
- Notion propio: la base de leads de Sanitas se llama [nombre de la base de leads] y las bases propias de la app se crean dentro de una página llamada [nombre de la app].
- Usuarios, contraseñas, `SESSION_SECRET`, token de Notion y token de WhatsApp nuevos. Nunca reutilices los de BUT Calls.
- Si hacemos la app de Android, con su propio identificador y su propia clave de firma (la de BUT Calls no sirve ni se comparte). El archivo `public/.well-known/assetlinks.json` del código de partida es de BUT Calls: bórralo y créalo de nuevo con la huella de la clave nueva.
- WhatsApp: [mismo número que BUT Calls / un número nuevo para Sanitas].

## Marca

- Nombre de la app: [p. ej. «BUT Calls Sanitas» o el que queramos].
- Logo y colores: [los de BUT, como en BUT Calls / te paso otro logo]. En BUT Calls el logo se sacó del PDF de BUT Agency; si te paso uno nuevo, recórtalo bien y genera los iconos (192, 512, Apple, SVG claro y oscuro) como en `public/`.
- El logo de Sanitas solo se usa si somos agentes autorizados y nos lo dan ellos: [sí, te lo paso / no se usa]. No lo descargues de internet.
- Mantén el estilo: azul marino, crema y la tipografía del logo, salvo que te diga otros colores.

## Lo que se mantiene igual

Todos los módulos de BUT Calls, con las mismas reglas:

1. **Llamar en cola**: un lead cada vez; orden 2 antiguos sin llamar, 1 nuevo; rellamadas a su hora; ilocalizables al final y no antes de 3 horas; reserva para que dos personas nunca llamen al mismo lead; el lead pasa a ser de quien pulsa Llamar o guarda resultado; 5 intentos sin localizar y pasa a PERDIDO; llamar desde el ordenador avisa al móvil; pausa con ventana que bloquea hasta «Reanudar»; botón «Fichar salida» en el inicio; lámina con frase en el hueco de abajo; celebración «¡Firmado!» con el nombre del cliente y sin más texto.
2. **Agenda** de rellamadas: calendario y lista, personal y global.
3. **Ficha y lista de leads**: notas y documentos en los comentarios de la página de Notion; asignación masiva; el comercial solo ve en Leads los suyos que ya ha llamado.
4. **WhatsApp compartido** con Whapi: el comercial solo ve sus chats (sin «Global»), dirección ve todos y asigna; no leídos; mensajes preparados por usuario.
5. **Portal del empleado**: fichaje legal (hora del servidor, firma contra cambios, correcciones solo por dirección con motivo), petición de corrección por el trabajador, descansos, vacaciones con aprobación, nóminas en PDF, jornada fijada por dirección y fin de jornada 5 minutos antes.
6. **Avisos**: campana y avisos de dirección a todo el equipo.
7. **Contrataciones y dinero** solo para dirección, con catálogo editable y recálculo si una venta se cae.
8. **Panel de dirección**: conversión por periodo y comercial, velocidad de respuesta, registro de llamadas, de dónde viene el dinero, perfil de los leads.
9. **Bonos** de equipo e individuales.
10. **Ayuda**: tutoriales cortos para el comercial y guía completa para dirección, siempre al día.
11. **Equipo**: usuarios, roles, jornada y pestaña Embudo opcional por comercial.
12. **Claves** (solo dirección): usuario, contraseña y enlace del portal donde se carga el contrato, cifrados; el comercial los ve con un botón en la ficha.
13. **Modo demostración** sin `NOTION_TOKEN`, con datos inventados de Sanitas.
14. Instalable en iPhone (aviso con los pasos en la pantalla de acceso) y, si lo quiero, APK de Android.

## Lo que cambia para Sanitas

El código de partida tiene mucho de O2 metido dentro (fibra, códigos de carga, rappel por lotes, Movistar, «Seguimiento O2», el lector de contratos de O2). Adapta cada cosa o quítala, y pregúntame lo que no esté claro:

- **Formulario de los leads.** En O2 eran compañía actual, cuánto paga, titular, tele y código postal (`src/lib/fields.ts`). En Sanitas son: [p. ej. edad, número de personas a asegurar, provincia, seguro actual, tipo de seguro que busca]. Mira la base real antes de decidir.
- **Estados del lead.** Los saca la app de la columna de estado de Notion. Los de Sanitas: [lista, o «míralos en Notion»]. Dime cuál es la venta y cuáles cierran el lead.
- **Productos y comisiones.** En O2 están en `src/lib/catalog.ts`. Los de Sanitas: [te paso la tabla]. El catálogo sigue siendo editable por dirección.
- **Extras por volumen.** En O2 eran rappel por lotes al mes y trimestral, por código de carga. En Sanitas: [cómo funciona / no hay]. Si no hay, quita la barra de tramos y la recomendación de código.
- **Códigos de carga.** [En Sanitas también cargamos en varios códigos o agencias / no hay]. Si no hay, quita el aviso del código del día y deja Claves como claves del portal de Sanitas.
- **Qué cuenta como venta** para bonos y objetivos. En O2 solo contaba la fibra de primera residencia. En Sanitas: [p. ej. pólizas emitidas, por asegurado o por póliza].
- **Seguimiento de contrataciones.** En O2 era la base «Seguimiento O2». En Sanitas: [nombre de la base de seguimiento / créala tú]. Estados de la póliza: [p. ej. solicitada, emitida, en vigor, anulada].
- **Lectura del contrato.** El lector de `src/lib/contract.ts` es para el PDF de O2. Te paso una solicitud de Sanitas de ejemplo: [adjunta]. Si no es un PDF con texto, dímelo.
- **Mensajes preparados de WhatsApp.** Reescríbelos para Sanitas (en O2 hablaban de la oferta de fibra y móvil).
- **Textos.** Repasa toda la app y la Ayuda: nada de fibra, O2, Movistar ni «ventas de fibra».

**Datos de salud.** Un seguro de salud puede tocar información médica, que es una categoría especial de datos personales. Pide a los comerciales que no apunten en las notas enfermedades ni datos médicos, y dímelo si algún campo del formulario los recoge.

## Decisiones ya tomadas con el cliente

Vienen de usar BUT Calls. Respétalas sin preguntar:

- Al comercial, lo mínimo: sin contadores de leads pendientes, sin «0 hechas · quedan 144», sin estadísticas de más, sin recuento en los bonos de ventas. Panel suyo muy básico.
- El comercial nunca ve dinero, comisiones ni el nombre real de los códigos, y tampoco le llega del servidor.
- El comercial no ve el enlace «Abrir en Notion».
- Sin emojis: iconos de línea propios. Sin `window.confirm` ni `window.prompt`: diálogos propios.
- El botón «Ilocalizable» tiene que verse claro. Todos los estados a la vista, sin plegar.
- La pausa no saca de la pantalla: bloquea hasta «Reanudar».
- Pantallas vacías con la marca, no texto gris.
- Notificaciones push: descartadas por ahora. Cotejar el registro de llamadas del operador: descartado.
- Cada cambio de funciones se refleja en la Ayuda (petición expresa del cliente).

## Opcional, para una segunda fase

En BUT Calls quedó estudiado y sin hacer:

- **Mensajes automáticos de WhatsApp al marcar el resultado**: «no te he localizado» al marcar Ilocalizable, confirmación al marcar Rellamar, siguientes pasos al firmar.
- **«Llámame a las X» → agenda**: Whapi avisa a la app de cada mensaje (webhook) y Claude lee el mensaje y propone la rellamada; el comercial la confirma con un toque. Más adelante, automática si la petición está clara.
- Las ideas de `PENDIENTES.md`.

No lo hagas sin que te lo pida.

## Cómo quiero que trabajes

- Pruébalo todo en el modo demostración, en móvil y en ordenador, con el navegador automatizado. Las pruebas de `pruebas/` adáptalas a Sanitas y pásalas antes de cada subida.
- No escribas en el Notion ni en el WhatsApp reales para probar sin pedírmelo. Leer sí.
- Mira los datos reales antes de decidir.
- Dime qué has probado y qué no, y distingue lo probado con datos inventados de lo probado en real.
- Si algo no se puede hacer, dímelo claro y propón la alternativa.
- Decide tú lo pequeño y cuéntamelo; pregúntame lo que cambie el rumbo o cueste dinero.
- Nunca me pidas contraseñas ni tokens por el chat: usa el formulario seguro. Ningún secreto en el repositorio.
- Háblame en español y sin tecnicismos: no soy técnico.

## Lo que necesito que me pidas antes de empezar

1. El token de una integración de Notion nueva, por el formulario seguro, y que comparta con ella la base de leads de Sanitas y una página para la app.
2. El nombre, el logo y los colores.
3. La tabla de productos y comisiones de Sanitas y cómo funcionan los extras, si los hay.
4. Una solicitud o contrato de Sanitas de ejemplo.
5. Los estados y la base de seguimiento de pólizas.
6. El WhatsApp: si es el mismo número o uno nuevo, y su token de Whapi.
7. Cómo lo despliego en Vercel (te guío paso a paso).

## Orden de construcción

1. Copiar el código, quitar lo de O2, conectar el Notion de Sanitas y el modo demostración con datos de Sanitas.
2. Llamar, ficha, agenda y lista con los campos y estados de Sanitas.
3. Contrataciones, catálogo y dinero de Sanitas.
4. Textos, Ayuda, marca y pruebas.
5. Despliegue en Vercel.
6. WhatsApp, y si lo quiero, el APK.

Enséñame algo funcionando después de cada bloque y espera mi visto bueno para el siguiente.
