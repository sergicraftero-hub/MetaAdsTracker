# Pruebas

Pruebas de navegador (Playwright) que recorren la app en el **modo demostración**: sin `NOTION_TOKEN`, con datos inventados. No tocan el Notion ni el WhatsApp reales.

```bash
pruebas/pasar.sh
```

Pasa todas, una a una, cada una con la demo recién arrancada en el puerto 3100, y dice cuáles van bien y cuáles fallan. Para pasar solo algunas: `pruebas/pasar.sh lock plan`. Las capturas y los registros quedan en `pruebas/capturas/` (no se suben al repositorio).

Conviene pasarlas antes de subir cualquier cambio.

| Prueba | Qué comprueba |
| --- | --- |
| `t3` | Recorrido general: llamar, resultados, ficha, permisos del comercial |
| `lock` | Dos personas no reciben el mismo lead |
| `turno` | Reparto solo entre quienes han fichado |
| `fin` | Bloqueo al final de la jornada |
| `ag`, `new3` | Agenda: personal, global y calendario |
| `audit` | Registro de llamadas para dirección |
| `portal` | Fichaje, vacaciones y nóminas |
| `aviso`, `news` | Avisos de dirección y campana |
| `wa`, `unread` | WhatsApp: envío, asignación y no leídos |
| `codigo`, `plan` | Código del día, cambio de código y plan del mes |
| `cat`, `recalc` | Catálogo editable y recálculo de comisiones |
| `nuevo` | Barra de tramos, celebración, pantallas vacías y lámina |
| `cambios` | Pausa, fichar salida, estados a la vista, lista de leads y embudo del comercial, claves por código |
| `iphone` | Aviso de instalación en iPhone |
| `look`, `url` | Aspecto general y que el comercial no ve «Abrir en Notion» |

`desfasadas/` guarda pruebas antiguas que dejaron de pasar al cambiar las pantallas (nombres de pestañas, botones). Se conservan como referencia; lo que cubrían está en las de arriba, salvo la lectura del contrato (`ventas`), que necesita un contrato real en PDF y no se guarda aquí por llevar datos de un cliente.

`respaldo/leads_antes_de_asignar.json` es la copia de cómo estaban asignados los leads antes del reparto masivo a AYA (solo identificadores, sin datos personales).
