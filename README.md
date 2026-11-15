# BUT Calls

CRM de seguimiento comercial de leads. Es una app web instalable (PWA): el mismo código funciona en macOS, Windows, iPhone y Android, y los datos viven en la base de datos de Notion `LEADS O2`. La app lee y escribe en Notion; no tiene base de datos propia.

## Qué hace

- **Llamar**: modo de llamadas en cola. Sale un lead cada vez con sus datos, sus respuestas y sus notas; al marcar el resultado se guarda en Notion y aparece el siguiente. El orden es 2 leads antiguos sin llamar, 1 nuevo, y así sucesivamente; las rellamadas con hora se cuelan cuando llega su hora y las atrasadas se intercalan una por ciclo. Cuando se acaban los leads sin llamar entran los ilocalizables. Antes de enseñar un lead se reserva para quien lo va a llamar: mientras está reservado (hasta que se guarda el resultado, o 20 minutos) no le sale a nadie más, ni a otro comercial ni a dirección; si dos lo piden a la vez, solo uno lo recibe. Reservar no asigna: un lead sin comercial pasa a ser de quien pulsa «Llamar» o guarda el resultado. El reparto depende del fichaje: un comercial solo recibe llamadas mientras tiene la jornada abierta en el Portal, y los leads sin contactar e ilocalizables de un comercial que hoy no ha fichado (baja, vacaciones, día libre) salen al resto; quien consigue contactar con uno se lo queda. Dirección puede llamar sin fichar. Al quinto intento sin localizar a un lead, pasa solo al estado `PERDIDO` y la cola no lo vuelve a sacar (se recupera cambiándole el estado en Leads). Cuando al comercial le quedan 5 minutos de la jornada que le ha fijado dirección en Equipo, recibe un aviso y dejan de salirle llamadas. Arriba se ven los bonos en juego.
- **Agenda**: todas las rellamadas pendientes, pasadas y futuras, en calendario mensual o en lista. En ordenador se arrastra una rellamada a otro día para moverla. Son de todo el equipo: cada comercial ve las suyas y puede ver las de los demás; si el dueño no atiende una a su hora (15 minutos de margen), le sale en la cola a quien esté de turno.
- **Leads**: buscador y filtros por estado y comercial; alta manual; dirección puede asignar varios leads de golpe a un comercial.
- **Ficha**: llamar, WhatsApp y email; registrar intento (rellena `1ER/2DO/3ER_INTENTO`, `INTENTOS` y `FECHA_CONTACTO`); cambiar estado; programar rellamada; asignar comercial; notas y contrato.
- **Notas y contrato**: son los comentarios de la página del lead en Notion, igual que los usa el equipo a mano. La app los lee y añade nuevos (con el nombre de quien escribe delante), y el contrato se sube como archivo adjunto de un comentario (hasta 4 MB).
- **Llamar desde el ordenador**: en un ordenador, el botón «Llamar» envía un aviso al móvil o tablet donde el mismo usuario tenga la app abierta; al aceptarlo, el teléfono marca el número.
- **WhatsApp**: bandeja del número compartido del equipo a través de Whapi.Cloud: lista de chats, conversación, envío de texto y archivos. Cada comercial tiene «Mis chats» (los que llevan su etiqueta o son de sus leads) y «Global» (todos). Un chat se asigna con una etiqueta de WhatsApp Business que lleva el nombre del comercial, así que también se ve desde la app de WhatsApp; quien contesta primero a un chat sin dueño se lo queda. Se puede marcar un chat como no leído y filtrar los no leídos. Cada mensaje enviado desde la app indica quién lo escribió. Cada usuario tiene sus mensajes preparados (por ejemplo «No localizado»), que se pegan en la caja con el nombre del cliente y se editan en «Mis mensajes».
- **Embudo**: tablero por estado; en ordenador se arrastra un lead para cambiarlo de estado.
- **Panel**: tasas de conversión (a firmado, de contacto y de cierre) para 7, 30 y 90 días, 1 año, máximo o un periodo a medida, filtrando por uno o varios comerciales; evolución por día, semana o mes; desglose por comercial, estado, compañía y gasto. Debajo, la actividad de llamadas por persona y el registro de llamadas una a una (quién llamó a quién, teléfono, hora, resultado y duración). La duración real se mide con el tiempo que el móvil pasa fuera de la app tras pulsar Llamar, y se marcan para revisar los resultados guardados sin llamar y las llamadas de pocos segundos. La app no puede leer el historial de llamadas del teléfono.
- **Portal del empleado**:
  - *Fichaje*: entrada, descansos y salida con contador en marcha. La hora la pone el servidor. Cada trabajador ve y descarga su registro mensual (CSV); dirección ve el de todos. Solo dirección corrige un registro, con motivo obligatorio, y queda anotado quién, cuándo y el valor anterior. Cada registro lleva una firma: si alguien lo cambia directamente en Notion, la app lo marca como «Alterado».
  - *Vacaciones*: calendario para pedir vacaciones u otras ausencias; dirección aprueba o rechaza. Las ausencias aprobadas se ven en el calendario de todos.
  - *Nóminas*: dirección sube el PDF de cada trabajador y mes; cada uno descarga solo las suyas.
- **Avisos** (campana arriba a la derecha): al comercial le avisa de una rellamada suya que toca ahora, de un cliente suyo que escribe por WhatsApp, de su jornada si lleva más de 10 horas abierta, de solicitudes resueltas y de nóminas nuevas. A dirección, de las solicitudes pendientes (se aprueban o rechazan ahí mismo) y de quien no ha fichado la salida. Solo funcionan con la app abierta.
- **Ayuda**: para el trabajador, cuatro tutoriales paso a paso (fichar, llamar, WhatsApp, vacaciones y nóminas) y unas preguntas rápidas. Para dirección, además, una guía completa con buscador que explica cómo funciona cada regla de la app. El texto está en `src/components/Help.tsx`.
- **Equipo** (solo dirección): usuarios (alta, edición, acceso y contraseña), bonos (uno para todo el equipo y otros individuales, con premio, meta y periodo) y comprobación de la conexión con Notion.

**Roles.** Dirección ve todo y puede reasignar. Cada comercial ve los leads cuya columna `COMERCIAL` coincide con su código, las rellamadas pendientes de todo el equipo y, por defecto, también los leads que no tienen comercial (se le asignan cuando le salen en la cola). Para que solo vean los suyos: `COMERCIAL_VE_SIN_ASIGNAR=false`.

Los estados y comerciales se leen de las opciones de las columnas de Notion, así que añadir uno en Notion lo añade en la app.

## Interfaz

- Iconos de línea propios (`src/components/Icon.tsx`); la app no usa emojis.
- Confirmaciones y formularios cortos con diálogos propios (`src/components/Dialogs.tsx`), nunca con las ventanas del navegador.
- En móvil la barra inferior tiene cuatro pestañas fijas (Llamar, Agenda, WhatsApp, Portal) y el resto está en «Más».
- Las animaciones se desactivan solas si el dispositivo tiene activada la opción de reducir movimiento.

## Puesta en marcha (Vercel)

1. En [vercel.com](https://vercel.com) → *Add New → Project* → importa este repositorio. No hay que cambiar ningún ajuste de compilación.
2. En *Environment Variables* añade las de `.env.example`:
   - `NOTION_TOKEN`: token de la integración de Notion.
   - `NOTION_LEADS_DB_ID`: `bb3ba35266e88398bb0f01f40fa122fc`.
   - `SESSION_SECRET`: una cadena aleatoria larga.
   - `ADMIN_EMAIL` y `ADMIN_PASSWORD`: el acceso de dirección inicial.
3. *Deploy*. Abre la dirección que da Vercel y entra con el email y la contraseña de dirección.

### Datos propios de la app

La app guarda sus propios datos en bases de datos de Notion que crea ella sola dentro de una página llamada exactamente **BUT Calls**, compartida con la integración (`···` → *Conexiones*): «Usuarios», «Registro de llamadas», «Bonos», «Avisos de llamada», «WhatsApp enviados», «Reservas de llamada», «Ajustes de usuario», «Fichajes», «Solicitudes» y «Nóminas». Cada una aparece la primera vez que hace falta.

En *Equipo → Añadir usuario* se da de alta a cada comercial con su código de la columna `COMERCIAL`. Las contraseñas se guardan cifradas (hash scrypt), nunca en claro.

La integración de Notion necesita permiso para leer y escribir contenido, leer e insertar comentarios y leer usuarios.

### Registro de jornada: qué cubre y qué no

El fichaje está pensado para el registro diario de jornada que exige el artículo 34.9 del Estatuto de los Trabajadores: hora concreta de inicio y fin de cada jornada, disponible para el trabajador, sus representantes y la Inspección de Trabajo, y conservado cuatro años. A tener en cuenta:

- Los registros viven en la base «BUT Calls · Fichajes» de Notion. No los borres antes de cuatro años.
- Quien tenga acceso de edición a esa base en Notion puede cambiar filas a mano. La app lo detecta y lo marca, pero no lo impide: limita ese acceso a dirección.
- La app no calcula horas extraordinarias ni controla los límites de jornada; da el total trabajado por día y por mes.
- Esto no es asesoramiento legal: conviene que vuestra gestoría confirme que encaja con vuestro convenio.

### WhatsApp compartido (opcional)

1. En [whapi.cloud](https://whapi.cloud) crea un canal y escanea el QR con el teléfono del número del equipo.
2. Copia el token del canal en la variable `WHAPI_TOKEN` de Vercel y vuelve a desplegar.

Sin `WHAPI_TOKEN` la pestaña WhatsApp explica cómo conectarlo y los botones de WhatsApp abren el WhatsApp del dispositivo. Whapi es una pasarela no oficial sobre WhatsApp Web: WhatsApp puede bloquear un número que escriba de forma masiva a contactos que no le han escrito antes.

### Instalar la app

- **iPhone**: abrirla en Safari → Compartir → *Añadir a pantalla de inicio*.
- **Android**: abrirla en Chrome → menú → *Instalar aplicación*.
- **macOS / Windows**: abrirla en Chrome o Edge → icono de instalar en la barra de direcciones (en Safari: Archivo → *Añadir al Dock*).

Sin conexión la app se abre y muestra los últimos datos cargados; para guardar cambios hace falta conexión.

## Desarrollo

```bash
npm install
npm run dev
```

Sin `NOTION_TOKEN` la app arranca en **modo demostración** con datos inventados (dirección: `demo@demo.com`; comercial: `ana@demo.com`; contraseña `demo`). Para trabajar contra Notion, copia `.env.example` a `.env.local` y rellénalo.

- `src/lib/fields.ts`: nombre de cada columna de Notion y qué estados cuentan como ganado o descartado.
- `src/lib/notion.ts`: lectura y escritura en Notion (con caché y sincronización incremental).
- `src/lib/leadRules.ts`: permisos por rol y registro de intentos.
- `src/components/queue.ts`: orden de la cola del modo «Llamar».
- `src/lib/bonus.ts`: cómo se calcula el progreso de los bonos.
- `src/components/`: pantallas.
