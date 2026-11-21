"use client";
import { useEffect, useState } from "react";
import type { LeadsPayload } from "@/lib/types";
import Icon, { type IconName } from "./Icon";

type Go = "llamar" | "hoy" | "leads" | "whatsapp" | "panel" | "portal" | "equipo";

interface Step {
  icon: IconName;
  title: string;
  text: string;
}
interface Guide {
  id: string;
  icon: IconName;
  title: string;
  summary: string;
  go: Go;
  goLabel: string;
  steps: Step[];
}

/* ---------- Tutoriales para el trabajador: lo básico, en pasos cortos ---------- */

const GUIDES: Guide[] = [
  {
    id: "fichar",
    icon: "clock",
    title: "Fichar tu jornada",
    summary: "Entrada, descansos y salida.",
    go: "portal",
    goLabel: "Ir a Portal",
    steps: [
      { icon: "play", title: "Ficha al empezar", text: "Entra en Portal y pulsa «Entrar». El contador empieza a correr. Hasta que no fiches, no te salen llamadas. Al fichar te sale el código en el que cargar tus ventas de hoy y cuántas faltan. Si a lo largo del día te salta «Cambia de código», usa el nuevo desde ese momento." },
      { icon: "coffee", title: "Apunta tus descansos", text: "Cuando pares, pulsa «Empezar descanso». Al volver, «Volver del descanso». El contador se para mientras tanto." },
      { icon: "stop", title: "Ficha al terminar", text: "Al acabar el día pulsa «Fichar salida» en la pantalla de Llamar, o «Salir» en Portal. Tu jornada queda guardada." },
      { icon: "pencil", title: "Si te equivocas o se te olvida", text: "En Portal, busca ese día en tu registro y pulsa «Pedir corrección». Cuenta qué pasó y a qué hora fue de verdad. Dirección lo revisa y lo arregla." },
      { icon: "sunset", title: "Cuando se acaba tu jornada", text: "Cinco minutos antes de cumplir tus horas te avisamos y dejan de salirte llamadas. Termina lo que tengas abierto y ficha la salida." },
      { icon: "help", title: "¿Se te olvidó fichar?", text: "Ficha en cuanto te acuerdes y díselo a dirección: solo ellos pueden corregir la hora. Si llevas muchas horas con la jornada abierta, la campana te avisa." },
    ],
  },
  {
    id: "llamar",
    icon: "phone",
    title: "Hacer llamadas",
    summary: "Un lead cada vez: llamas, marcas y siguiente.",
    go: "llamar",
    goLabel: "Ir a Llamar",
    steps: [
      { icon: "play", title: "Pulsa «Empezar a llamar»", text: "Te sale un lead con sus datos y lo que contestó en el formulario. No tienes que elegir a quién llamar: la app te los va dando." },
      { icon: "mobile", title: "Pulsa «Llamar»", text: "En el móvil se marca el número. En el ordenador te llega un aviso al móvil; acéptalo y llama desde ahí." },
      { icon: "note", title: "Escribe una nota si hace falta", text: "Lo que te cuente el cliente va en «Notas». Se guarda sola al marcar el resultado." },
      { icon: "check", title: "Marca el resultado", text: "Ilocalizable si no lo coge, Rellamar, Interesado, Firmado… Al pulsarlo se guarda y aparece el siguiente lead." },
      { icon: "alarm", title: "Si hay que volver a llamar", text: "Elige «Rellamar» y pon el día y la hora. Cuando llegue ese momento, la campana te avisa y el lead te vuelve a salir." },
      { icon: "calendar", title: "Mira tu agenda", text: "En Agenda ves tus rellamadas en un calendario («Personal» son las tuyas, «Global» las de todos): las atrasadas en rojo y las que vienen en azul. Toca un día para ver a quién toca llamar. Si necesitas mover una, abre el lead y cambia la fecha." },
      { icon: "trophy", title: "Si firma", text: "Pulsa «Firmado» y sube el contrato en PDF: la app lo lee y rellena sola lo que ha contratado. Revisa los productos, marca si la fibra es para su vivienda habitual y guarda. Arriba de la ficha te decimos en qué código cargar la venta: pulsa ese botón para ver el SFID, el usuario y la contraseña con los que cargarla." },
    ],
  },
  {
    id: "whatsapp",
    icon: "chat",
    title: "Contestar WhatsApp",
    summary: "Tus chats con tus clientes, dentro de la app.",
    go: "whatsapp",
    goLabel: "Ir a WhatsApp",
    steps: [
      { icon: "user", title: "«Mis chats» son los tuyos", text: "En WhatsApp ves solo tus conversaciones: las de tus leads y las que te asigne dirección." },
      { icon: "pencil", title: "Abre un chat y escribe", text: "Escribe abajo y pulsa «Enviar». Con el clip adjuntas un archivo. Si contestas a un chat que no era de nadie, pasa a ser tuyo." },
      { icon: "bolt", title: "Usa un mensaje preparado", text: "Encima de la caja tienes tus mensajes hechos, por ejemplo «No localizado». Púlsalo y se pega con el nombre del cliente; revísalo y envía. En «Mis mensajes» los cambias a tu gusto." },
      { icon: "eyeoff", title: "¿Lo abriste sin querer?", text: "Pulsa «No leído» arriba del chat. Queda marcado para que no se te olvide, y lo encuentras con «Solo no leídos»." },
      { icon: "bell", title: "Te avisamos", text: "Cuando un cliente tuyo te escribe, la campana de arriba a la derecha te lo dice." },
    ],
  },
  {
    id: "portal",
    icon: "sun",
    title: "Vacaciones y nóminas",
    summary: "Pedir días libres y descargar tu nómina.",
    go: "portal",
    goLabel: "Ir a Portal",
    steps: [
      { icon: "calendar", title: "Pide tus vacaciones", text: "En Portal → Vacaciones, toca el primer día y luego el último en el calendario. Elige el tipo y pulsa «Enviar solicitud»." },
      { icon: "hourglass", title: "Espera la respuesta", text: "La solicitud queda «pendiente» hasta que dirección la aprueba o la rechaza. La campana te avisa cuando lo hagan." },
      { icon: "file", title: "Descarga tu nómina", text: "En Portal → Nóminas tienes las tuyas, por mes. Pulsa «Descargar». Cuando suban una nueva, también te avisa la campana." },
    ],
  },
];

const DONE_KEY = "but-calls-ayuda-hechos";

function Tutorial({ guide, done, onDone, goTo }: { guide: Guide; done: boolean; onDone: () => void; goTo: (t: Go) => void }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const step = guide.steps[i];
  const last = i === guide.steps.length - 1;

  if (!open) {
    return (
      <button className="card guide" onClick={() => { setOpen(true); setI(0); }}>
        <span className="guide-icon"><Icon name={guide.icon} size={22} /></span>
        <span className="guide-text">
          <strong>{guide.title}</strong>
          <span className="muted hint">{guide.summary} · {guide.steps.length} pasos</span>
        </span>
        <span className={done ? "pill on" : "pill"}>{done ? "Visto" : "Empezar"}</span>
      </button>
    );
  }
  return (
    <section className="card guide-open" aria-label={guide.title}>
      <div className="between">
        <h2><Icon name={guide.icon} size={18} /> {guide.title}</h2>
        <button className="btn small" onClick={() => setOpen(false)}>Cerrar</button>
      </div>
      <div className="dots" aria-hidden>
        {guide.steps.map((_, k) => <i key={k} className={k === i ? "on" : k < i ? "past" : ""} />)}
      </div>
      <div className="step-card" aria-live="polite">
        <span className="step-icon"><Icon name={step.icon} size={30} /></span>
        <span className="muted hint">Paso {i + 1} de {guide.steps.length}</span>
        <strong className="step-title">{step.title}</strong>
        <p>{step.text}</p>
      </div>
      <div className="contact">
        <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>Anterior</button>
        {last ? (
          <button
            className="btn primary"
            onClick={() => {
              onDone();
              setOpen(false);
              goTo(guide.go);
            }}
          >
            {guide.goLabel}
          </button>
        ) : (
          <button className="btn primary" onClick={() => setI(i + 1)}>Siguiente</button>
        )}
      </div>
    </section>
  );
}

/* ---------- Guía completa para dirección ---------- */

const MANUAL: { title: string; items: [string, string][] }[] = [
  {
    title: "Cómo se reparten las llamadas",
    items: [
      ["Orden de la cola", "A cada comercial le sale un lead cada vez: 2 leads antiguos sin llamar, 1 nuevo, y se repite. Cuando se acaban los leads sin llamar, entran los ilocalizables."],
      ["Rellamadas", "Una rellamada con hora de hoy pasa delante de todo cuando llega su hora. Las atrasadas de otros días, o de hoy sin hora, se intercalan una por ciclo para no tapar los leads nuevos."],
      ["Solo quien ha fichado", "Un comercial solo recibe llamadas mientras tiene la jornada abierta en el Portal. Dirección puede llamar sin fichar."],
      ["Fin de jornada", "En Equipo pones las horas de jornada al día de cada persona (0 = sin límite). Cuando al comercial le quedan 5 minutos de tiempo trabajado (los descansos no cuentan), le salta un aviso y la pestaña Llamar deja de darle leads; el que tenga en pantalla puede terminarlo. Dirección no tiene límite."],
      ["Comercial ausente", "Los leads sin contactar e ilocalizables de un comercial que hoy no ha fichado (baja, vacaciones, día libre) salen al resto. Quien consigue hablar con uno se lo queda. Los leads ya contactados siguen siendo suyos."],
      ["Que nadie llame al mismo", "Mientras alguien tiene un lead en pantalla queda reservado y no le sale a nadie más, hasta que guarda el resultado o pasan 20 minutos. Si dos lo piden a la vez, solo uno lo recibe."],
      ["Cuándo se asigna", "Un lead sin comercial pasa a ser de quien pulsa «Llamar» o guarda un resultado. Solo con verlo en pantalla no se asigna."],
      ["Límite de 5 intentos", "Al quinto intento de llamada sin localizar al lead (sigue en Ilocalizable o sin estado), pasa solo al estado PERDIDO y la cola no lo vuelve a sacar. Para recuperarlo hay que abrirlo en Leads y cambiarle el estado. Si en el quinto intento se consigue hablar con él, no se pierde."],
      ["Ilocalizables", "Vuelven a salir a su comercial cuando han pasado 3 horas desde el último intento, primero los que llevan menos intentos."],
      ["Agenda", "Muestra todas las rellamadas pendientes, pasadas y futuras, en calendario o en lista. Las atrasadas salen en rojo. En ordenador se arrastra una rellamada a otro día para moverla (conserva la hora); en móvil se cambia desde la ficha del lead. Cada comercial elige entre «Personal» (las suyas) y «Global» (las de todo el equipo); dirección ve la global o la de un comercial concreto."],
      ["Rellamadas de otro", "Si el dueño no atiende una rellamada a su hora, a los 15 minutos le sale a quien esté de turno. En la Agenda cualquiera puede ver las de todo el equipo."],
      ["Lo que la cola no controla", "Si alguien llama a mano desde Leads o desde Notion, fuera de la pestaña Llamar, no hay reserva."],
    ],
  },
  {
    title: "Leads, estados y notas",
    items: [
      ["De dónde salen los datos", "La app lee y escribe en la base «LEADS O2» de Notion. Los estados y los comerciales son las opciones de las columnas ESTADO y COMERCIAL: si añades uno en Notion, aparece en la app."],
      ["Qué cuenta como firmado", "El estado FIMADO. Al marcarlo, el lead pasa a ESTADO_CONTRATO = FIRMADO."],
      ["Qué cuenta como descartado", "Al final no, No interesado, Contrato con otra compañía, Número erróneo, Cliente existente O2, Repetido, Quiere móvil finan, Sin cobertura y Contrato O2 por otro canal. El resto de estados se consideran «en curso»."],
      ["Registrar intento", "Rellena 1ER/2DO/3ER_INTENTO con la fecha y hora, suma INTENTOS y pone FECHA_CONTACTO la primera vez."],
      ["Notas y contrato", "Son los comentarios de la página del lead en Notion, con el nombre de quien escribe delante. El contrato va como archivo adjunto de un comentario (hasta 4 MB)."],
      ["Asignar varios leads", "En Leads → «Asignar varios», marcas los leads (o todos los de la lista filtrada) y eliges el comercial."],
      ["Abrir en Notion", "El botón «Abrir en Notion» de la ficha solo lo ve dirección. A los comerciales no se les envía el enlace a Notion."],
      ["Qué ve cada uno", "Dirección ve todo. Un comercial ve sus leads, los que no tienen comercial, las rellamadas pendientes de todo el equipo y lo sin contactar de compañeros que hoy no han fichado."],
    ],
  },
  {
    title: "Contrataciones y dinero",
    items: [
      ["Dónde están", "En vuestra base «Seguimiento O2» de Notion. La pestaña Contrataciones la lee y la escribe; la primera vez añade las columnas que le faltan (Productos, Origen, Primera residencia, Comercial, LeadId, Baja y Contrato)."],
      ["Qué hace el comercial", "Al marcar «Firmado» sube el contrato en PDF. La app lee el punto de venta, la fecha, el producto y la cuota, las líneas adicionales, el nombre, el DNI, el teléfono y si viene de Movistar (operador donante o portabilidad interna). El comercial revisa los productos, marca si es primera residencia y guarda. No ve ningún importe."],
      ["Comisión de cada venta", "Suma de las comisiones de sus productos según la tabla de O2. Se guarda en la columna Comisión y dirección puede corregirla a mano."],
      ["Catálogo editable", "En Contrataciones → «Catálogo y comisiones» dirección cambia los productos, la cuota, la comisión que paga O2 por cada uno, si cuentan como fibra y los tramos de los rápeles por lotes y trimestral. Un producto desactivado deja de ofrecerse al comercial pero se sigue viendo en las ventas antiguas. «Restaurar el de partida» vuelve a la tabla original."],
      ["Códigos", "Son las opciones de la columna «Codigo de carga». El comercial solo ve «Código 1», «Código 2»… por orden; el nombre real (LT00…) solo lo ve dirección. Se añaden desde Contrataciones → «Añadir código»."],
      ["En qué código cargar", "La app planifica lo que queda de mes: estima cuántas fibras se venderán aún (según el ritmo del mes, o el número que fije dirección en Contrataciones) y busca el reparto entre códigos que da más rápel en total. Cada tramo cuenta por lo que añade sobre lo ya ganado: pasar de 4 a 11 fibras vale 650 €, no 1.100 €. Por eso no siempre conviene el tramo más cercano: con 7 ventas por delante puede rendir más llevar un código de 4 a 11 que otro de 16 a 21. Para elegir el código solo se mira el rápel por lotes (las altas del mes); el trimestral no entra, así que el código es el mismo venga o no el cliente de Movistar. Al fichar la entrada, al comercial le salta en pantalla «Hoy carga las ventas en: Código X» con las ventas de fibra que faltan hasta cambiar de tramo, y tiene que pulsar Entendido. Si durante el día pasa a convenir otro código, le salta «Cambia de código» (se comprueba cada minuto y tras cada venta). Nunca ve importes."],
      ["Resumen por código en Llamar", "Dirección ve en la pantalla de inicio de Llamar un resumen del mes por código: fibras, ventas, dinero, lo que falta para el siguiente tramo y en cuál conviene cargar ahora. Los comerciales no lo ven."],
      ["Claves de cada código", "En la pestaña Claves, dirección pone el SFID (la numeración del código), el usuario, la contraseña y, si quiere, el enlace del portal donde se carga el contrato de cada código. Desde ahí también se añade un código nuevo con su SFID. En la ficha del lead, el aviso «Si contrata, cárgalo en Código X» es un botón: al pulsarlo, el comercial ve el SFID, el usuario y la contraseña de ese código, con botones de copiar y de abrir el portal. No ve el nombre real del código. Las claves se guardan cifradas: en Notion solo aparece texto ilegible. Si se cambia el SESSION_SECRET de Vercel, hay que volver a escribirlas."],
      ["Barra de tramos", "En Contrataciones y en el resumen de Llamar, cada código lleva una barra con una marca en cada escalón del rápel (4, 11, 15…): lo relleno es lo conseguido y la marca resaltada, el siguiente tramo. El comercial ve la misma barra de su código del día, solo con números de fibras, sin importes."],
      ["Celebración y frase del día", "Al guardar una venta firmada sale una animación breve de «¡Firmado!» que no bloquea la pantalla. En la pantalla de inicio de Llamar hay una lámina con una frase para animar; cambia cada día y con cada llamada, y al tocarla pasa a otra."],
      ["Extra por lotes", "Por código y mes natural, según altas de fibra: 4–10 → 450 €, 11–14 → 1.100 €, 15–20 → 1.500 €, 21–30 → 2.000 €, 31–40 → 2.300 €, 41 o más → 2.600 €. Cuentan también las de origen Movistar."],
      ["Extra trimestral", "Por código y trimestre natural, solo fibras que no vienen de Movistar: 15–29 → 750 €, 30 o más → 1.800 €."],
      ["Qué cuenta como fibra", "Convergentes y fibra sola, de primera residencia y que no estén de baja. No cuentan la fibra adicional, las líneas móviles ni M+."],
      ["Bajas y no instalados", "En Editar, la casilla «Baja o no instalado» hace que la venta deje de cobrar comisión y de contar. Todo se recalcula solo: los rápeles por lotes y trimestral, el dinero por código y por comercial, y los objetivos."],
      ["De dónde viene el dinero", "En Contrataciones se ve cuánto sale de las ventas (comisiones) y cuánto del rápel por lotes, y con «Ver por producto» cuánto aporta cada producto. El rápel trimestral va aparte porque no es de un solo mes."],
      ["Qué cuenta para objetivos", "Solo las fibras de primera residencia que siguen en pie. No cuentan las líneas móviles, las segundas residencias ni las bajas o no instaladas. La tabla «Por comercial» separa las que cuentan de las que no, para que los objetivos no se calculen mal."],
      ["Ventas antiguas", "Las que ya estaban en «Seguimiento O2» conservan su comisión real. Como no dicen productos, origen ni residencia, se cuentan como fibra de primera residencia y origen Movistar hasta que las edites; si su comisión es menor que la de la fibra más barata, se cuentan como venta de solo líneas. Las filas «BONO…» apuntadas a mano no se suman, porque la app ya calcula los lotes."],
      ["Contrato", "Se guarda en la columna Contrato de «Seguimiento O2» y en los comentarios del lead. En Contrataciones se previsualiza con el botón «Contrato»."],
    ],
  },
  {
    title: "WhatsApp compartido",
    items: [
      ["Cómo funciona", "Es el número del equipo conectado por Whapi (QR escaneado en su panel). Todos los usuarios ven la misma bandeja."],
      ["Mis chats y Global", "El comercial solo ve sus chats: los que llevan su etiqueta o son de sus leads; el servidor no le envía los demás. «Global», con todos los chats, es solo para dirección, que es quien asigna los que llegan sin dueño."],
      ["Asignar un chat", "Con el desplegable de arriba del chat. Por dentro es una etiqueta de WhatsApp Business con el nombre del comercial, así que también se ve desde el móvil. Quien contesta primero a un chat sin dueño se lo queda."],
      ["Mensajes preparados", "Cada usuario tiene los suyos, encima de la caja de escribir, y los edita en «Mis mensajes». Al pulsar uno se pega en la caja con el nombre del cliente ({nombre}) y el suyo ({yo}); no se envía solo. Todos empiezan con tres de partida: No localizado, Segundo intento y Te paso la oferta."],
      ["No leído", "Abrir un chat lo marca como leído para el cliente. El botón «No leído» lo vuelve a marcar y le pone la etiqueta «No leído», que ve todo el equipo."],
      ["Quién escribió", "Los mensajes enviados desde la app llevan el nombre del comercial. Los enviados desde el móvil o WhatsApp Web salen sin nombre."],
      ["Riesgo", "Whapi no es la vía oficial de WhatsApp. Si se envía el mismo texto a muchos contactos que no han escrito antes, WhatsApp puede bloquear el número."],
      ["Si deja de funcionar", "La pestaña dirá que el número no está conectado: hay que volver a escanear el QR en el panel de Whapi."],
    ],
  },
  {
    title: "Panel y bonos",
    items: [
      ["Conversión a firmado", "De los leads que entraron en el periodo, qué porcentaje está firmado hoy."],
      ["Tasa de contacto", "Leads del periodo que tienen algún estado o fecha de primer contacto."],
      ["Cierre sobre contactados", "Firmados entre los leads contactados."],
      ["Velocidad de respuesta", "En Panel: tiempo desde que entra el lead hasta la primera llamada (la hora sale de «1ER_INTENTO»). Muestra el tiempo habitual (mediana), qué porcentaje se llama en menos de 5 minutos, de 1 hora y de 24 horas, cuántos leads siguen esperando su primera llamada y, en «Ver por comercial», el tiempo de cada uno. No descuenta noches ni festivos."],
      ["Periodos y comerciales", "7, 30 y 90 días, 1 año, Máximo o un periodo con fechas. Puedes marcar uno o varios comerciales."],
      ["Actividad de llamadas", "Sale del registro de la pestaña Llamar: llamadas, contactos (llamadas con respuesta), firmados, tiempo medio por lead, llamadas por hora y primera y última llamada del día."],
      ["Registro de llamadas", "En Panel → Actividad, debajo de la tabla por persona: cada llamada con la hora, quién llamó, el lead (cruzado con Notion), el teléfono, el resultado y dos tiempos. «En llamada» es lo que el móvil estuvo fuera de la app tras pulsar Llamar, es decir, la duración real aproximada (incluye los tonos); «Con el lead» es desde que le apareció hasta que guardó el resultado."],
      ["Llamadas para revisar", "Se marcan dos casos: «Sin pulsar Llamar» (guardó un resultado en la cola sin llamar) y «Llamada de X s» (pulsó Llamar pero volvió en menos de 8 segundos). El filtro «Solo para revisar» las aísla. Los intentos apuntados a mano desde la ficha salen como «Apuntado en la ficha»."],
      ["Límite del registro", "La app no puede leer el historial de llamadas del teléfono (ninguna app web puede). El tiempo se mide solo si se llama desde el móvil con la app, o aceptando en el móvil el aviso de una llamada pedida desde el ordenador. Para una verificación exacta hace falta el detalle de llamadas del operador o una centralita en la nube."],
      ["Qué ve el comercial", "Solo tres números suyos (llamadas y contactos de hoy, firmados del mes) y sus bonos. No ve cuántos leads quedan. En los bonos de fibras ve la barra de avance pero no el recuento. En Leads solo le salen los suyos que ya ha llamado; los nuevos le llegan por Llamar. La pestaña Embudo no la ve salvo que dirección se la active."],
      ["Pausa y salida", "«Pausar» en la pantalla de llamar no devuelve al inicio: tapa la pantalla con una ventana «En pausa» y un contador, y no deja hacer nada hasta pulsar «Reanudar». El lead sigue reservado; si la pausa es tan larga que otra persona lo ha cogido, al reanudar se pasa al siguiente. La pausa no se apunta como descanso en el fichaje: para eso está el Portal. En la pantalla de inicio de Llamar hay un botón «Fichar salida»."],
      ["Resultados de la llamada", "Los botones muestran todos los estados de vuestra columna ESTADO: los que siguen abiertos, Firmado, y debajo, a la vista, los que cierran el lead (No interesado, Número erróneo, Sin cobertura…)."],
      ["Bonos", "En Equipo → Bonos. Uno «de todo el equipo» suma lo de todos, incluida dirección si llama; uno individual solo lo de esa persona. Se elige qué cuenta (fibras firmadas, contactos o llamadas), la meta y si se renueva cada día, semana o mes."],
      ["Qué suma en un bono", "Las fibras firmadas salen de Contrataciones: fibra de primera residencia que no esté de baja ni sin instalar, del comercial que figura en la venta. Llamadas y contactos salen de la pestaña Llamar."],
      ["Perfil de los leads", "En Panel, «Cómo son los leads que entran» reparte los leads en porcentaje según lo que contestaron (compañía, lo que pagan, tele, titular), con un desplegable para elegir qué mirar y cuántos de cada grupo acaban firmando."],
    ],
  },
  {
    title: "Portal del empleado",
    items: [
      ["Fichaje", "Entrada, descansos y salida. La hora la pone el servidor, no el dispositivo. Cada trabajador ve y descarga su registro; dirección ve el de todos y puede descargar el mes en CSV."],
      ["Pedir corrección de un fichaje", "Si un trabajador se olvida de fichar o ficha mal, pulsa «Pedir corrección» en ese día de su registro y explica qué pasó. El registro queda marcado como «Corrección pedida» y a dirección le llega a la campana. Dirección abre «Corregir» en ese día, ve la petición, ajusta las horas con su motivo y la petición se cierra sola; también puede descartarla. El registro no cambia hasta que dirección lo corrige, y la petición queda anotada en el historial de la corrección."],
      ["Corregir un fichaje", "Solo dirección, en Portal → Fichaje → «Corregir». El motivo es obligatorio y queda anotado quién, cuándo y el valor anterior."],
      ["«Alterado»", "Cada registro lleva una firma. Si alguien lo cambia directamente en Notion, la app lo marca como Alterado. Limita a dirección el acceso a la base «BUT Calls · Fichajes»."],
      ["Normativa", "Cubre el registro diario de jornada (art. 34.9 del Estatuto de los Trabajadores): inicio y fin de cada jornada, consultable por el trabajador y descargable para una inspección. Hay que conservarlo cuatro años: no borres la base. La app no calcula horas extra. Confírmalo con vuestra gestoría."],
      ["Vacaciones", "El trabajador pide días en el calendario; quedan pendientes hasta que dirección aprueba o rechaza, desde la campana o desde Portal → Vacaciones. Las aprobadas se ven en el calendario de todos."],
      ["Nóminas", "En Portal → Nóminas subes el PDF eligiendo trabajador y mes (hasta 4 MB). Cada trabajador solo ve y descarga las suyas."],
    ],
  },
  {
    title: "Avisos, usuarios y datos",
    items: [
      ["Avisos a todo el equipo", "Dirección abre la campana y pulsa «Enviar aviso a todo el equipo»: escribe un mensaje y le llega a todos los usuarios, dirección incluida. Aparece en la campana durante dos semanas y salta en pantalla la primera vez que cada persona abre la app (o en menos de un minuto si la tiene abierta). Dirección puede borrarlo desde la misma campana."],
      ["Campana de dirección", "Solicitudes pendientes, con Aprobar y Rechazar, y trabajadores con la jornada abierta más de 10 horas."],
      ["Campana del trabajador", "Rellamada suya que toca ahora, cliente suyo que escribe por WhatsApp, jornada abierta más de 10 horas, solicitud aprobada o rechazada y nómina nueva."],
      ["Límite de los avisos", "Solo saltan con la app abierta. No llegan como notificación del móvil con la app cerrada."],
      ["Llamar desde el ordenador", "El botón Llamar envía un aviso al móvil o tablet donde ese mismo usuario tenga la app abierta; al aceptarlo, el teléfono marca."],
      ["Usuarios", "En Equipo: alta, edición, activar o desactivar y cambio de contraseña. Al crear o editar un comercial se elige si puede ver la pestaña Embudo (por defecto, no). El «código» de cada comercial tiene que coincidir exactamente con su opción en la columna COMERCIAL de Notion."],
      ["Dónde se guarda cada cosa", "Todo está en Notion. Los leads, en «LEADS O2». Lo propio de la app, en bases que crea sola dentro de la página «BUT Calls»: Usuarios, Registro de llamadas, Bonos, Avisos de llamada, WhatsApp enviados, Reservas de llamada, Fichajes, Solicitudes y Nóminas."],
      ["Instalar la app", "iPhone: Safari → Compartir → Añadir a pantalla de inicio (en un iPhone, la pantalla de acceso enseña estos pasos hasta pulsar «Entendido»). Android: también hay un APK para instalar directamente. Android: Chrome → menú → Instalar aplicación. Ordenador: Chrome o Edge → icono de instalar en la barra de direcciones."],
      ["Sin conexión", "La app se abre y enseña los últimos datos cargados, pero para guardar cambios hace falta conexión."],
    ],
  },
];

export default function Help({ data, goTo }: { data: LeadsPayload; goTo: (t: Go) => void }) {
  const admin = data.me.role === "admin";
  const [done, setDone] = useState<string[]>([]);
  const [view, setView] = useState<"basico" | "completo">(admin ? "completo" : "basico");
  const [q, setQ] = useState("");

  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(DONE_KEY) ?? "[]"));
    } catch {}
  }, []);
  const mark = (id: string) => {
    const next = [...new Set([...done, id])];
    setDone(next);
    try {
      localStorage.setItem(DONE_KEY, JSON.stringify(next));
    } catch {}
  };

  const needle = q.trim().toLowerCase();
  const sections = MANUAL.map((s) => ({ ...s, items: s.items.filter(([t, x]) => !needle || `${s.title} ${t} ${x}`.toLowerCase().includes(needle)) })).filter((s) => s.items.length);

  return (
    <div className="stack narrow">
      {admin && (
        <div className="seg" role="group" aria-label="Tipo de ayuda">
          <button className={view === "completo" ? "active" : ""} onClick={() => setView("completo")}>Guía de dirección</button>
          <button className={view === "basico" ? "active" : ""} onClick={() => setView("basico")}>Tutoriales del equipo</button>
        </div>
      )}

      {view === "basico" && (
        <>
          <p className="muted">Cuatro guías cortas con lo que necesitas cada día. Pulsa una y sigue los pasos.</p>
          {GUIDES.map((g) => (
            <Tutorial key={g.id} guide={g} done={done.includes(g.id)} onDone={() => mark(g.id)} goTo={goTo} />
          ))}
          <section className="card">
            <h2>Preguntas rápidas</h2>
            <details>
              <summary>¿Cómo pongo la app en mi móvil?</summary>
              <p className="hint">iPhone: ábrela en Safari → Compartir → «Añadir a pantalla de inicio». Android: ábrela en Chrome → menú → «Instalar aplicación».</p>
            </details>
            <details>
              <summary>No me salen llamadas</summary>
              <p className="hint">Comprueba que has fichado la entrada en Portal. Si ya has fichado y pone «No queda nadie por llamar», es que no hay leads pendientes para ti ahora mismo.</p>
            </details>
            <details>
              <summary>¿Cuántas veces se llama a un lead que no contesta?</summary>
              <p className="hint">Cinco. Al quinto intento sin localizarle pasa a «Perdido» y deja de salirte. Si más adelante quieres retomarlo, búscalo en Leads.</p>
            </details>
            <details>
              <summary>¿Qué es la campana de arriba?</summary>
              <p className="hint">Tus avisos: un mensaje de dirección para todo el equipo, una rellamada que te toca, un cliente que te ha escrito, tus vacaciones aprobadas o una nómina nueva. Solo avisa con la app abierta.</p>
            </details>
            <details>
              <summary>Me he equivocado al marcar un resultado</summary>
              <p className="hint">Busca el lead en la pestaña Leads, ábrelo y cambia el estado en su ficha.</p>
            </details>
          </section>
        </>
      )}

      {view === "completo" && (
        <>
          <input type="search" placeholder="Buscar en la guía (p. ej. rellamadas, bonos, fichaje)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar en la guía" />
          {sections.map((s) => (
            <section className="card" key={s.title}>
              <h2>{s.title}</h2>
              <dl className="manual">
                {s.items.map(([t, x]) => (
                  <div key={t}>
                    <dt>{t}</dt>
                    <dd>{x}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          {sections.length === 0 && <p className="muted">Nada en la guía coincide con «{q}».</p>}
        </>
      )}
    </div>
  );
}
