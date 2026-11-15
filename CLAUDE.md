# BUT Calls

CRM de seguimiento comercial (Next.js, PWA) sobre Notion. Ver `README.md` para qué hace y cómo se despliega.

## Reglas del proyecto

- **Ayuda al día.** Cada vez que se añada o cambie una función, revisa `src/components/Help.tsx` y actualízalo si hace falta: los tutoriales del trabajador (`GUIDES`, pasos cortos y sencillos, solo lo que un comercial usa a diario) y la guía de dirección (`MANUAL`, con el detalle de cada regla). Petición expresa del cliente.
- La interfaz y los textos van en español.
- Los datos viven en Notion: los leads en «LEADS O2» y lo propio de la app en bases que crea sola dentro de la página «BUT Calls». No añadir otra base de datos sin hablarlo.
- No escribir en el Notion ni en el WhatsApp reales del cliente para probar sin su permiso; el modo demostración (sin `NOTION_TOKEN`) cubre las pruebas.
- Al comercial, lo mínimo: nada de contadores de leads pendientes ni estadísticas de más. El detalle es para dirección.
- **Estilo visual.** Sin emojis: usar los iconos de `src/components/Icon.tsx`. Sin `window.confirm` ni `window.prompt`: usar `useDialogs()` de `src/components/Dialogs.tsx`. Mantener el azul marino, el crema y la tipografía del logo.
- **Dinero.** Las comisiones, los importes y el nombre real de los códigos de carga son solo para dirección. `src/lib/catalog.ts` y `src/lib/sales.ts` no se importan desde componentes; lo que vaya al comercial pasa por `forSeller` / `catalogFor(false)`.
- **Pruebas.** Antes de subir un cambio, pasar `pruebas/pasar.sh` (modo demostración). Si se añade una función, añadir o ampliar su prueba en `pruebas/`.
- **App de Android.** `android/` es un envoltorio (Trusted Web Activity) que abre la web; la clave de firma no está en el repositorio, la guarda el cliente. `public/.well-known/assetlinks.json` lleva la huella de esa clave: no borrarlo.
