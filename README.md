# BUT Calls

CRM de seguimiento comercial de leads. Es una app web instalable (PWA): el mismo código funciona en macOS, Windows, iPhone y Android, y los datos viven en la base de datos de Notion `LEADS O2`. La app lee y escribe en Notion; no tiene base de datos propia.

## Qué hace

- **Hoy**: rellamadas de hoy y atrasadas, leads nuevos sin contactar, ilocalizables por reintentar y próximas rellamadas.
- **Leads**: buscador y filtros por estado y comercial; alta manual de leads.
- **Ficha**: llamar, WhatsApp y email con un toque; registrar intento (rellena `1ER/2DO/3ER_INTENTO`, `INTENTOS` y `FECHA_CONTACTO`); cambiar estado; programar rellamada; comentarios; asignar comercial.
- **Embudo**: tablero por estado; en ordenador se arrastra un lead para cambiarlo de estado.
- **Panel**: leads, contactados, firmados y cierre, por día, estado, comercial, compañía y gasto mensual.
- **Equipo** (solo dirección): usuarios y comprobación de la conexión con Notion.

**Roles.** Dirección ve todo y puede reasignar. Cada comercial ve los leads cuya columna `COMERCIAL` coincide con su código y, por defecto, también los que no tienen comercial (se le asignan al registrar el primer intento). Para que solo vean los suyos: `COMERCIAL_VE_SIN_ASIGNAR=false`.

Los estados y comerciales se leen de las opciones de las columnas de Notion, así que añadir uno en Notion lo añade en la app.

## Puesta en marcha (Vercel)

1. En [vercel.com](https://vercel.com) → *Add New → Project* → importa este repositorio. No hay que cambiar ningún ajuste de compilación.
2. En *Environment Variables* añade las de `.env.example`:
   - `NOTION_TOKEN`: token de la integración de Notion.
   - `NOTION_LEADS_DB_ID`: `bb3ba35266e88398bb0f01f40fa122fc`.
   - `SESSION_SECRET`: una cadena aleatoria larga.
   - `ADMIN_EMAIL` y `ADMIN_PASSWORD`: el acceso de dirección inicial.
3. *Deploy*. Abre la dirección que da Vercel y entra con el email y la contraseña de dirección.

### Dar acceso a los comerciales

1. En Notion crea una página con una base de datos vacía (por ejemplo «Usuarios CRM») y compártela con la integración (`···` → *Conexiones*).
2. Copia su ID (los 32 caracteres del enlace) en la variable `NOTION_USERS_DB_ID` de Vercel y vuelve a desplegar.
3. En la app, *Equipo → Añadir usuario*. La app crea sola las columnas (`Email`, `Rol`, `Codigo`, `Password`, `Activo`). Las contraseñas se guardan cifradas (hash scrypt), nunca en claro.

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
- `src/components/`: pantallas.
