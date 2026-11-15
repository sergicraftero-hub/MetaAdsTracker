# Prompt para crear una app como BUT Calls

Copia todo lo que hay debajo de la línea, rellena lo que va entre corchetes `[ ]` y pégalo como primer mensaje en una sesión nueva de Claude Code con un repositorio vacío. Lo que no aplique a tu caso, bórralo: cada módulo es independiente.

---

Quiero que construyas una app de seguimiento comercial para un equipo de ventas por teléfono. Te doy el contexto, lo que tiene que hacer y cómo quiero que trabajes. Antes de escribir código, léelo entero y pídeme lo que te falte de la sección «Lo que necesito que me pidas».

## Contexto del negocio

- Empresa: [nombre]. Vendemos [producto o servicio] a [tipo de cliente].
- Los leads entran por [formulario de Meta Ads / web / otro] y hoy los llevamos en [Notion / hoja de cálculo / otro CRM].
- Equipo: [n] comerciales que llaman, y dirección ([n] personas) que supervisa.
- Nombre de la app: [nombre]. Te paso el logo; si tiene tipografía y colores, mantén esa identidad.

## Plataforma

- Tiene que funcionar en móvil (iPhone y Android) y en ordenador (Windows y Mac) con un solo código: una web instalable (PWA).
- Stack: Next.js con TypeScript, desplegada en Vercel. Sin librerías de interfaz pesadas; CSS propio.
- Los datos viven en [Notion, en la base que ya tenemos / una base de datos propia]. Si es Notion: la app lee y escribe por su API desde el servidor, nunca desde el navegador, y lo que necesite guardar por su cuenta lo crea ella sola en bases dentro de una página que yo comparto con la integración. No añadas otra base de datos sin consultarme.
- La app se adapta a las columnas que ya existen: lee el esquema real (nombres, tipos, opciones de los desplegables) en vez de suponerlo, y si le falta una columna la crea.

## Roles

- **Dirección** ve y edita todo.
- **Comercial** ve solo lo suyo y lo mínimo: nada de contadores de leads pendientes, estadísticas de más ni dinero. Lo que no deba ver, que tampoco le llegue por dentro (el servidor no se lo envía).
- Login con email y contraseña, con un administrador inicial por variables de entorno. Contraseñas con hash, sesiones firmadas, límite de intentos.

## Módulos

### 1. Llamadas en cola
- Una pantalla que enseña un lead cada vez, con sus datos y lo que contestó en el formulario. Al marcar el resultado se guarda y aparece el siguiente.
- Orden de la cola: [2 leads antiguos sin llamar, 1 nuevo, y repetir]. Las rellamadas con hora pasan delante cuando llega su hora; las atrasadas se intercalan. Cuando se acaban los leads sin llamar, entran los no localizados.
- Botones de resultado con nombres claros y uno destacado para la venta. Los estados salen de las opciones que ya hay en la base.
- Reserva: mientras alguien tiene un lead en pantalla, no le sale a nadie más; si dos lo piden a la vez, solo uno lo recibe. El lead pasa a ser de quien pulsa llamar o guarda un resultado, no de quien solo lo ve.
- Tras [5] intentos sin localizar, el lead pasa a perdido y deja de salir.
- Los no localizados no vuelven a salir hasta pasadas [3] horas.
- En el ordenador, el botón de llamar envía un aviso al móvil del mismo usuario para que marque desde allí.

### 2. Agenda de rellamadas
- Calendario mensual y lista, con vista personal y global. Las atrasadas resaltadas. En ordenador, arrastrar para cambiar de día.
- Si el dueño no atiende una rellamada en [15] minutos, le sale a quien esté de turno.

### 3. Ficha del lead y listado
- Buscador y filtros; alta manual; asignación de varios leads de golpe (solo dirección).
- Notas y archivos adjuntos guardados donde el equipo ya los guarda hoy: [comentarios de la página en Notion / otro sitio]. Averígualo mirando los datos reales antes de decidir.

### 4. WhatsApp compartido
- Bandeja del número del equipo dentro de la app, con vista «mis chats» y «global», asignación de chats a comerciales, marcar como no leído y mensajes preparados que cada usuario edita (con el nombre del cliente y el suyo).
- Proveedor: [Whapi u otro]. Adviérteme del riesgo de bloqueo si la vía no es la oficial.

### 5. Portal del empleado
- Fichaje con entrada, descansos y salida, hora puesta por el servidor, registro mensual descargable, correcciones solo por dirección con motivo y rastro. Debe servir para el registro de jornada que exige la ley en [España].
- Dirección fija las horas de jornada de cada persona; [5] minutos antes del final se avisa y dejan de salirle llamadas.
- Solo recibe llamadas quien ha fichado. Lo de quien no ha fichado ese día pasa al resto.
- Vacaciones: se piden en un calendario y dirección aprueba o rechaza.
- Nóminas: dirección sube el PDF y cada persona descarga solo las suyas.

### 6. Avisos
- Una campana para todos. Al comercial: rellamada que toca, cliente que escribe, fin de jornada, solicitud resuelta, nómina nueva. A dirección: solicitudes pendientes con aprobar y rechazar a un clic, y jornadas sin cerrar.
- Dirección puede enviar un aviso de texto a todo el equipo.

### 7. Contrataciones y dinero (solo dirección)
- Al marcar una venta, el comercial indica qué ha vendido (varios productos) y sube el contrato. Si el contrato es un PDF con texto, la app lo lee y rellena sola lo que pueda. Te paso un contrato de ejemplo.
- Catálogo de productos con su comisión, editable por dirección. Te paso la tabla.
- Comisión por venta y extras por volumen: [tramos por código y mes; tramos por trimestre; qué ventas cuentan y cuáles no]. Los tramos son importes totales, no acumulados.
- Si una venta se cae o no se instala, todo se recalcula solo.
- Si trabajamos con varios códigos o puntos de venta: la app recomienda en cuál cargar cada venta para ganar más, planificando lo que queda de mes y no solo el siguiente tramo. El comercial ve un alias y cuántas ventas faltan, nunca importes ni el nombre real.
- Backoffice para editar cada venta, verla con el contrato delante y marcar cobrado.

### 8. Panel de dirección
- Conversión por periodo (7, 30, 90 días, 1 año, todo, fechas a medida) y por comercial.
- Velocidad de respuesta: tiempo desde que entra el lead hasta la primera llamada.
- Registro de llamadas una a una (quién, a quién, cuándo, cuánto), marcando las que se anotan sin haber llamado.
- De dónde viene el dinero (ventas y extras), con desglose por producto.
- Perfil de los leads que entran, en porcentajes.
- Todo minimalista: cifras clave grandes y el detalle plegado.

### 9. Objetivos y bonos
- Dirección crea bonos de equipo e individuales con premio, meta y periodo. Solo cuentan [las ventas que cumplan estas condiciones].

### 10. Ayuda
- Para el comercial: tutoriales cortos paso a paso de lo que usa a diario.
- Para dirección: una guía completa con buscador que explique cada regla.
- Mantenla al día: cada vez que añadas o cambies algo, actualiza la ayuda.

## Diseño

- Limpio y actual. Azul marino y crema [o los colores de mi marca], con la tipografía del logo en los títulos.
- Sin emojis: iconos de línea propios y de un solo estilo.
- Sin ventanas del navegador (`confirm`, `prompt`): diálogos propios.
- En móvil, cuatro pestañas fijas abajo y el resto en «Más».
- Transiciones suaves, desactivadas si el dispositivo pide reducir movimiento.
- Modo claro y oscuro.

## Cómo quiero que trabajes

- **Modo demostración.** Sin credenciales, la app arranca con datos inventados. Pruébalo todo ahí, en móvil y en ordenador, con el navegador automatizado.
- **No escribas en mis datos reales para probar sin pedírmelo.** Leer sí; escribir, pregúntame antes.
- **Mira los datos reales antes de decidir.** Lee la estructura y unos cuantos registros para ver cómo trabajamos de verdad; no supongas.
- **Dime qué has probado y qué no**, y distingue lo probado con datos inventados de lo probado en real.
- **Si algo no se puede hacer, dímelo claro y propón la alternativa**, en vez de hacer algo a medias.
- **Decide tú lo pequeño y cuéntamelo; pregúntame lo que cambie el rumbo.**
- Sube cada cambio al repositorio con mensajes claros y deja un README con cómo desplegar.
- Guarda las reglas del proyecto en un `CLAUDE.md` para que las sesiones siguientes las respeten.
- Nunca me pidas contraseñas ni tokens por el chat: usa el formulario seguro.

## Lo que necesito que me pidas antes de empezar

1. Acceso a los datos: el token de la integración por formulario seguro y qué bases tengo que compartir.
2. Una exportación o acceso de lectura a la base actual, para ver columnas y valores reales.
3. El logo.
4. La tabla de productos y comisiones, y las reglas de los extras.
5. Un contrato de ejemplo, si quiero que se lea solo.
6. Los datos del proveedor de WhatsApp, si lo quiero.
7. Dónde lo despliego y con qué nombre.

## Límites que ya conozco (no hace falta que los intentes)

- Una app web no puede leer el historial de llamadas del teléfono. Se puede medir cuánto tiempo sale el móvil de la app al llamar, que da una duración aproximada.
- Las notificaciones con la app cerrada necesitan un servicio externo que la despierte cada minuto; sin eso, los avisos solo se ven con la app abierta.
- No se puede meter la sesión de una web de terceros desde la app, ni guardar sus credenciales: como mucho, abrirla con los datos del cliente a mano.
- WhatsApp por pasarelas no oficiales tiene riesgo de bloqueo del número.
- Con Notion como base de datos, la app va más lenta según crecen los registros y cualquiera con acceso puede editar a mano; a partir de unos miles conviene una base propia.

## Orden de construcción que te propongo

1. Lectura de la base real, login, roles y modo demostración.
2. Llamadas en cola, ficha del lead y agenda.
3. Panel de dirección.
4. Portal del empleado y avisos.
5. WhatsApp.
6. Contrataciones y dinero.
7. Ayuda y pasada final de diseño.

Enséñame algo funcionando después de cada bloque y espera mi visto bueno para el siguiente.
