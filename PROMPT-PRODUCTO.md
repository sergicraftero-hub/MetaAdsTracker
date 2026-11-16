# Prompt para crear el CRM como producto para vender

Es la versión «para vender» de BUT Calls: el mismo CRM, pero pensado para que muchas empresas lo contraten, cada una con sus datos separados y su propio backoffice. Los leads entran solos desde Facebook (webhooks de Meta) y se guardan en una base de datos propia, no en Notion.

Copia todo lo que hay debajo de la línea, rellena lo que va entre corchetes `[ ]` y pégalo como primer mensaje en una sesión nueva de Claude Code con un repositorio vacío.

---

Quiero que construyas un CRM de seguimiento comercial para equipos de venta por teléfono, como **producto para vender a otras empresas**. Te doy el contexto, lo que tiene que hacer y cómo quiero que trabajes. Antes de escribir código, léelo entero y pídeme lo que te falte de la sección «Lo que necesito que me pidas».

## Qué es el producto

- Nombre: [nombre del producto]. Marca y colores propios: [te paso el logo / propón una identidad].
- A quién se vende: empresas con comerciales que llaman a leads de anuncios de Meta (Facebook e Instagram). Sector de partida: [telecomunicaciones / seguros / energía / inmobiliaria / cualquiera].
- Cada empresa cliente tiene su cuenta, sus usuarios y sus datos, y **configura ella misma su backoffice** sin tocar código.
- Cómo se cobra: [suscripción mensual por usuario / por empresa / lo decidimos después].
- Idioma: español. Deja los textos preparados para traducir más adelante.

## Plataforma

- Web instalable (PWA) que funcione en iPhone, Android, Windows y Mac con un solo código.
- Stack: Next.js con TypeScript, desplegada en [Vercel]. CSS propio, sin librerías de interfaz pesadas.
- **Base de datos propia**: PostgreSQL alojado en la Unión Europea ([Supabase / Neon / el que recomiendes]). Explícame la opción antes de elegirla y lo que cuesta.
- Archivos (contratos, nóminas, adjuntos) en un almacenamiento privado, descargables solo con sesión y permiso.
- **Varias empresas en una sola instalación.** Cada dato lleva la empresa a la que pertenece y ninguna consulta puede devolver datos de otra. Quiero que esto se garantice en la base de datos (seguridad por filas), no solo en el código, y una prueba automática que lo demuestre.

## Roles

- **Propietario del producto (yo).** Panel propio para ver las empresas cliente, darlas de alta o de baja, ver su uso y su estado de pago. No veo sus leads ni sus datos personales salvo que la empresa me lo permita para dar soporte.
- **Dirección de cada empresa.** Ve y configura todo lo suyo.
- **Comercial.** Ve solo lo suyo y lo mínimo: nada de contadores de leads pendientes, estadísticas de más ni dinero. Lo que no deba ver, que el servidor no se lo envíe.
- Acceso con email y contraseña, recuperación de contraseña por email, invitación de usuarios por enlace. Contraseñas con hash, sesiones firmadas, límite de intentos.

## Entrada de leads: webhooks de Meta

Es la pieza central y la que más cuidado necesita.

- Cada empresa conecta su página de Facebook desde su backoffice con el inicio de sesión de Meta, elige qué páginas y formularios quiere recibir y listo. Sin copiar tokens a mano.
- Cuando alguien rellena un formulario de un anuncio, Meta avisa a nuestro webhook, la app pide los datos del lead a Meta y lo guarda en la empresa correcta.
- Requisitos técnicos:
  - Verificación inicial del webhook y comprobación de la firma de cada aviso con el secreto de la app. Lo que no venga firmado se descarta.
  - Responder rápido a Meta y procesar después, con reintentos si falla la descarga del lead.
  - Sin duplicados: si Meta envía dos veces el mismo aviso, el lead se guarda una vez.
  - Guardar de qué campaña, conjunto, anuncio y formulario viene cada lead.
  - Tokens de página cifrados en la base de datos, renovación antes de que caduquen y aviso a dirección si la conexión se rompe.
  - Botón para recuperar los leads de los últimos días, por si el webhook estuvo caído.
- **Mapeo de campos.** Cada formulario tiene preguntas distintas. Dirección ve las preguntas de su formulario y elige a qué campo del lead va cada una (nombre, teléfono, email, código postal) y cuáles se guardan como «respuestas del formulario» para enseñarlas al comercial.
- Antes de programarlo, lee la documentación actual de Meta sobre webhooks de Lead Ads y dime: qué permisos pide la app, qué revisión de Meta hay que pasar, cuánto tarda y qué tengo que hacer yo. No lo des por sabido: cambia a menudo.
- Además del webhook, dos entradas más: alta manual e importación desde CSV, y un webhook genérico propio para quien traiga leads de otro sitio (web, Zapier, Make).

## Módulos

### 1. Llamadas en cola
- Una pantalla que enseña un lead cada vez, con sus datos y lo que contestó en el formulario. Al marcar el resultado se guarda y aparece el siguiente.
- Orden de la cola configurable por cada empresa. Por defecto: 2 leads antiguos sin llamar, 1 nuevo, y repetir. Las rellamadas con hora pasan delante cuando llega su hora; las atrasadas se intercalan. Cuando se acaban los leads sin llamar, entran los no localizados.
- Botones de resultado con nombres claros y uno destacado para la venta. **Los estados los define cada empresa** (nombre, color y si es abierto, ganado o perdido), partiendo de una plantilla.
- Reserva: mientras alguien tiene un lead en pantalla, no le sale a nadie más; si dos lo piden a la vez, solo uno lo recibe. El lead pasa a ser de quien pulsa llamar o guarda un resultado, no de quien solo lo ve.
- Tras [5] intentos sin localizar (configurable), el lead pasa a perdido. Los no localizados no vuelven a salir hasta pasadas [3] horas (configurable).
- En el ordenador, el botón de llamar envía un aviso al móvil del mismo usuario para que marque desde allí.
- Al descartar un lead, un toque para indicar el motivo.
- Aviso si entra un teléfono que ya existe.
- En el hueco de la pantalla de inicio, una lámina con una frase para animar, dibujada con HTML y CSS, que cambia cada día. Dirección puede escribir sus propias frases.

### 2. Agenda de rellamadas
- Calendario mensual y lista, con vista personal y global. Atrasadas resaltadas. En ordenador, arrastrar para cambiar de día.
- Si el dueño no atiende una rellamada en [15] minutos, le sale a quien esté de turno.

### 3. Ficha del lead y listado
- Buscador y filtros, alta manual, asignación de varios leads de golpe (solo dirección).
- Notas con autor y fecha, y archivos adjuntos.
- Historial completo del lead: de qué anuncio vino, cada llamada, cada cambio de estado y quién lo hizo.

### 4. WhatsApp compartido
- Bandeja del número del equipo dentro de la app: «mis chats» y «global», asignación a comerciales, marcar como no leído, filtro de no leídos y mensajes preparados que cada usuario edita (con el nombre del cliente y el suyo).
- Cada empresa conecta su propio número. Proveedor: [API oficial de WhatsApp Business / Whapi u otro]. Explícame la diferencia de coste y de riesgo de bloqueo antes de elegir; para un producto que se vende, valora primero la vía oficial.

### 5. Portal del empleado
- Fichaje con entrada, descansos y salida, hora puesta por el servidor, registro mensual descargable, correcciones solo por dirección con motivo y rastro. Debe servir para el registro de jornada que exige la ley en España.
- Dirección fija las horas de jornada de cada persona; [5] minutos antes del final se avisa y dejan de salirle llamadas.
- Solo recibe llamadas quien ha fichado. Lo de quien no ha fichado ese día pasa al resto.
- Vacaciones: se piden en un calendario y dirección aprueba o rechaza.
- Nóminas: dirección sube el PDF y cada persona descarga solo las suyas.
- Cada empresa puede apagar este módulo si no lo quiere.

### 6. Avisos
- Una campana para todos. Al comercial: rellamada que toca, cliente que escribe, fin de jornada, solicitud resuelta, nómina nueva. A dirección: solicitudes pendientes con aprobar y rechazar a un clic, jornadas sin cerrar y conexión con Meta o WhatsApp caída.
- Dirección puede enviar un aviso de texto a todo su equipo.

### 7. Backoffice de ventas y dinero (solo dirección)
Aquí está el valor del producto: **cada empresa monta el suyo sin programar.**
- **Catálogo.** Productos con familia, precio y comisión por venta. Alta, edición y desactivación. Importable desde CSV.
- **Registro de la venta.** Al marcar una venta, el comercial indica qué ha vendido (varios productos) y sube el contrato. Dirección define qué campos extra pide la venta (casillas, desplegables, texto).
- **Lectura del contrato.** Si el contrato es un PDF con texto, la app lo lee y propone los datos. Como cada empresa tiene contratos distintos, hazlo configurable y dime con sinceridad hasta dónde llega.
- **Extras por volumen.** Dirección define reglas de tramos: por mes o por trimestre, por canal o en total, qué ventas cuentan (por familia de producto o por un campo de la venta) y el importe de cada tramo. Los importes son totales del tramo, no acumulados.
- **Canales o códigos.** Si la empresa carga ventas en varios canales, códigos o puntos de venta con tramos separados, la app recomienda en cuál cargar cada venta para ganar más, planificando lo que queda de mes. El comercial ve un alias y cuántas ventas faltan para el siguiente tramo, con una barra de progreso; nunca importes ni el nombre real.
- **Estados de la venta** (firmada, instalada, cobrada, caída) definidos por la empresa. Si una venta se cae, todo se recalcula solo.
- **Cierre de mes.** Fija las cifras del mes para que un cambio posterior del catálogo no las mueva, y las exporta a Excel.
- **Aviso de ventas atascadas.** Si una venta lleva más de X días sin pasar al siguiente estado.

### 8. Panel de dirección
- Conversión por periodo (7, 30, 90 días, 1 año, todo, fechas a medida) y por comercial.
- **Rentabilidad por anuncio.** Leads, contactados, ventas e ingresos por campaña, conjunto y anuncio. Si la empresa da permiso para leer el gasto en Meta, coste por lead y coste por venta.
- Velocidad de respuesta: tiempo desde que entra el lead hasta la primera llamada.
- Mejor hora para llamar: en qué franjas se localiza más gente.
- Registro de llamadas una a una (quién, a quién, cuándo, cuánto), marcando las que se anotan sin haber llamado.
- De dónde viene el dinero (ventas y extras), con desglose por producto.
- Motivos de pérdida y perfil de los leads que entran, en porcentajes.
- Todo minimalista: cifras clave grandes, una gráfica de tendencia y el detalle plegado.

### 9. Objetivos y bonos
- Dirección crea bonos de equipo e individuales con premio, meta y periodo, y elige qué cuenta (llamadas, contactos o ventas que cumplan una condición).
- Al firmar, una celebración breve que no bloquea la pantalla.

### 10. Ayuda
- Para el comercial: tutoriales cortos paso a paso de lo que usa a diario.
- Para dirección: una guía completa con buscador que explique cada regla y cada ajuste del backoffice.
- Mantenla al día: cada vez que añadas o cambies algo, actualiza la ayuda.

### 11. Alta de una empresa nueva
- Asistente de primeros pasos: datos de la empresa, logo y color, conectar Meta, mapear el formulario, elegir una plantilla de estados, invitar al equipo. Con leads de ejemplo para probar antes de conectar nada.
- Cada empresa ve su logo y su color dentro de la app.
- Módulos que se encienden y apagan por empresa (WhatsApp, portal del empleado, dinero).

### 12. Cobro y planes
- [Stripe u otro] para la suscripción: periodo de prueba, alta, cambio de plan, impago y baja. Si hay impago, la empresa pasa a solo lectura durante unos días antes de bloquearse; nunca se borran sus datos sin avisar.
- Proponme dos o tres planes razonables y qué limita cada uno.

## Privacidad y ley

El producto guarda datos personales de terceros (nombre, teléfono, DNI, contratos, nóminas, fichajes). Quiero esto desde el primer día:

- Datos alojados en la Unión Europea y cifrados en reposo.
- Cada empresa puede exportar todos sus datos y borrar un lead concreto si el cliente lo pide.
- Registro de quién ha visto o cambiado qué en datos sensibles.
- Plazo de conservación configurable y borrado al darse de baja la empresa.
- Textos legales: aviso de privacidad, condiciones de uso y contrato de encargado de tratamiento. Déjame borradores marcados como «a revisar por un abogado»; no los des por válidos.
- Copias de seguridad diarias y una prueba de que se pueden restaurar.

## Diseño

- Limpio y actual, con la identidad del producto y el logo y color de cada empresa dentro de su cuenta.
- Sin emojis: iconos de línea propios y de un solo estilo.
- Sin ventanas del navegador (`confirm`, `prompt`): diálogos propios.
- En móvil, cuatro pestañas fijas abajo y el resto en «Más».
- Pantallas vacías cuidadas, con la marca y una línea de ayuda.
- Transiciones suaves, desactivadas si el dispositivo pide reducir movimiento. Modo claro y oscuro.

## Cómo quiero que trabajes

- **Modo demostración.** Sin credenciales, la app arranca con una empresa inventada y datos de ejemplo. Pruébalo todo ahí, en móvil y en ordenador, con el navegador automatizado.
- **Pruebas dentro del repositorio** desde el primer día, y pásalas antes de cada subida. Incluye la de aislamiento entre empresas y la del webhook de Meta con avisos simulados y firmados.
- **No escribas en datos reales ni en cuentas reales de Meta o WhatsApp para probar sin pedírmelo.**
- **Lee la documentación actual** de Meta, del proveedor de WhatsApp y del de pagos antes de integrarlos; no te fíes de la memoria.
- **Dime qué has probado y qué no**, y distingue lo probado con datos inventados de lo probado en real.
- **Si algo no se puede hacer, dímelo claro y propón la alternativa.**
- **Decide tú lo pequeño y cuéntamelo; pregúntame lo que cambie el rumbo o cueste dinero.**
- Sube cada cambio con mensajes claros, deja un README con cómo desplegar y guarda las reglas del proyecto en un `CLAUDE.md`.
- Nunca me pidas contraseñas ni claves por el chat: usa el formulario seguro. Ningún secreto en el repositorio.

## Lo que necesito que me pidas antes de empezar

1. Nombre, logo y colores del producto.
2. Dónde se despliega y qué dominio usará (hace falta uno propio para Meta y para los correos).
3. La cuenta de desarrollador de Meta y una página de Facebook de pruebas con un formulario.
4. La cuenta de base de datos, la de pagos y la de envío de correos.
5. El proveedor de WhatsApp, si se incluye en la primera versión.
6. Un ejemplo real de catálogo, comisiones y tramos, para comprobar que el backoffice configurable lo cubre.
7. Un contrato de ejemplo, si quiero la lectura automática.

## Límites que ya conozco (no hace falta que los intentes)

- Una app web no puede leer el historial de llamadas del teléfono. Se puede medir cuánto tiempo sale el móvil de la app al llamar, que da una duración aproximada.
- Las notificaciones con la app cerrada necesitan un servicio aparte; déjalas fuera de la primera versión.
- No se puede meter la sesión de una web de terceros desde la app, ni guardar sus credenciales.
- En iPhone no hay instalación por archivo: es «Añadir a pantalla de inicio» desde Safari. En Android se puede generar un APK que envuelve la web.
- WhatsApp por pasarelas no oficiales tiene riesgo de bloqueo del número.
- La app de Meta necesita pasar su revisión antes de recibir leads de páginas de clientes; cuenta con ese plazo.

## Orden de construcción que te propongo

1. Base de datos, empresas separadas, acceso, roles y modo demostración.
2. Webhook de Meta con mapeo de campos, alta manual e importación.
3. Llamadas en cola, ficha del lead y agenda.
4. Panel de dirección.
5. Backoffice de ventas y dinero configurable.
6. Portal del empleado y avisos.
7. WhatsApp.
8. Alta de empresas, planes y cobro.
9. Privacidad, ayuda y pasada final de diseño.

Enséñame algo funcionando después de cada bloque y espera mi visto bueno para el siguiente.
