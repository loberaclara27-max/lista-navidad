// Lista de Navidad — app
import { createClient } from './supabase.js'; // supabase-js 2.119.2 empaquetado

const SUPABASE_URL = 'https://jtpiqkvbokqphartcluf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MQACwjULR8gM9DdRTQQdjw_MMtCudf9'; // clave pública (segura en el navegador)
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

const app = document.getElementById('app');
window.listaNavidad = { sb }; // útil para depurar desde la consola
const ESTRELLA = '<path d="M12 1.5 13.6 10.4 22.5 12 13.6 13.6 12 22.5 10.4 13.6 1.5 12 10.4 10.4Z" fill="#b08d3c"></path>';
const CAMBIAR = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#9e2a2b" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4 3 8l4 4"></path><path d="M3 8h14a4 4 0 0 1 4 4"></path><path d="m17 20 4-4-4-4"></path><path d="M21 16H7a4 4 0 0 1-4-4"></path></svg>';
const CIRCULO = '<svg viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true"><path d="M10 23 C 5 10, 38 3, 63 4 C 93 5, 117 11, 114 22 C 111 34, 72 39, 46 37 C 19 35, 3 28, 12 14 C 15 10, 22 7, 30 6" fill="none" stroke="#3a3330" stroke-width="1.5" stroke-linecap="round" vector-effect="non-scaling-stroke"></path></svg>';
const CARAS = [
  { color: '#e8693a', boca: 'M12 29 Q20 21 28 29', nombre: 'Fatal: tráeme carbón' },
  { color: '#f2a024', boca: 'M13 27.5 Q20 23.5 27 27.5', nombre: 'Regular tirando a mal' },
  { color: '#fdd13c', boca: 'M13 26 L27 26', nombre: 'Normal' },
  { color: '#9bb85a', boca: 'M13 25 Q20 29.5 27 25', nombre: 'Bastante bien' },
  { color: '#458a5e', boca: 'M11 23.5 Q20 33 29 23.5', nombre: 'Como un ángel' }
];

// ---------- Estado ----------
const st = {
  pantalla: 'cargando',
  email: localStorage.getItem('email') || '',
  destinatario: localStorage.getItem('destinatario') || 'reyes',
  destElegido: false,
  codigo: '',
  error: '',
  ocupado: false,
  perfiles: [],
  perfil: null,
  carta: null,
  deseos: [],
  popup: false,
  ficha: null,
  cartaGuardada: false,
  taller: null,
  invitacion: localStorage.getItem('invitacion') || '',
  invitacionNombre: '',
  perfilForm: { nombre: '', emoji: '', familia: '', nombreFamilia: '', codigo: '', foto: null, fotoUrl: '' },
  solicitud: null
};

// ---------- Utilidades ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hoy = () => new Date();
function temporada(d = hoy()) {
  const y = d.getFullYear();
  return d.getMonth() >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}
const anioNavidad = (d = hoy()) => (d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1);
function dormido(d = hoy()) {
  const m = d.getMonth(), dia = d.getDate();
  return (m === 0 && dia > 6) || (m >= 1 && m <= 9);
}
const esSanta = () => st.destinatario === 'santa';
const rolNivel = (r) => ({ familiar: 0, nino: 1, elfo: 2, jefe: 3 }[r] ?? 0);
const reg = (n) => (n === 1 ? '1 regalo' : `${n} regalos`);
function ultimoGrafema(v) {
  try { return Array.from(new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(v), (x) => x.segment).pop() || ''; }
  catch (e) { return Array.from(v).pop() || ''; }
}
function ajustarEscala() {
  const k = Math.min(1, (app.clientWidth - 24) / 362);
  app.style.setProperty('--k', k.toFixed(3));
}
window.addEventListener('resize', ajustarEscala);

function ir(p) { st.pantalla = p; st.error = ''; render(); }
function fallo(e, texto) {
  console.error(e);
  st.error = texto || 'Algo ha fallado. Inténtalo de nuevo.';
  st.ocupado = false;
  render();
}

// ---------- Invitación por enlace ----------
(function leerInvitacion() {
  const u = new URL(location.href);
  const f = (u.searchParams.get('f') || '').trim().toUpperCase();
  if (f) {
    st.invitacion = f;
    localStorage.setItem('invitacion', f);
    u.searchParams.delete('f');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }
})();

// ---------- Carga ----------
async function cargar() {
  st.pantalla = 'cargando'; render();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return ir('sobre');
  st.uid = session.user.id;
  st.email = session.user.email;
  if (dormido()) return ir('dormido');

  const { data: perfiles, error } = await sb.from('perfiles')
    .select('id,nombre,emoji,foto_url,rol,familia_id,gestionado_por,familias(nombre)')
    .eq('user_id', st.uid);
  if (error) return fallo(error, 'No hemos podido cargar tu perfil.');
  st.perfiles = perfiles || [];

  if (!st.perfiles.length) {
    const { data: sol } = await sb.from('solicitudes_familia').select('id,nombre_familia,estado').eq('user_id', st.uid).eq('estado', 'pendiente').limit(1);
    if (sol && sol.length) { st.solicitud = sol[0]; return ir('espera'); }
    await prepararPerfil();
    return ir('perfil');
  }

  const guardado = localStorage.getItem('perfil');
  st.perfil = st.perfiles.find((p) => p.id === guardado) || st.perfiles[0];
  localStorage.setItem('perfil', st.perfil.id);
  await cargarCarta();
  ir('carta');
}

async function prepararPerfil() {
  st.perfilForm = { nombre: '', emoji: '', familia: '', nombreFamilia: '', codigo: '', foto: null, fotoUrl: '' };
  st.invitacionNombre = '';
  if (st.invitacion) {
    const { data } = await sb.rpc('familia_por_codigo', { p_codigo: st.invitacion });
    if (data) { st.invitacionNombre = data; st.perfilForm.familia = 'invitacion'; }
  }
}

async function cargarCarta() {
  const p = st.perfil;
  const [{ data: deseos, error: e1 }, { data: cartas }] = await Promise.all([
    sb.rpc('mi_carta', { p_perfil: p.id }),
    sb.from('cartas').select('portado,destinatario,guardada_en').eq('perfil_id', p.id).eq('temporada', temporada())
  ]);
  if (e1) throw e1;
  st.deseos = deseos || [];
  st.carta = (cartas && cartas[0]) || null;
  if (st.destElegido) {
    await sb.rpc('guardar_carta', { p_perfil: p.id, p_portado: st.carta ? st.carta.portado : 75, p_destinatario: st.destinatario });
    st.carta = Object.assign({ portado: 75 }, st.carta || {}, { destinatario: st.destinatario });
    st.destElegido = false;
  } else if (st.carta) {
    st.destinatario = st.carta.destinatario;
    localStorage.setItem('destinatario', st.destinatario);
  }
  st.popup = !st.carta && st.deseos.length === 0;
  st.cartaGuardada = false;
}

// ---------- Pantallas ----------
function pSobre() {
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(st.email.trim());
  return `
  <main class="pantalla cuadros"><div class="escena">
    <div class="escala"><div class="sobre">
      <img src="img/${esSanta() ? 'correo-santa' : 'correo-reyes'}.png" alt="${esSanta() ? 'Correo de Polo Norte' : 'Correo Royal Oriente'}, entrega express" style="height:82px;width:auto;display:block">
      <div style="width:100%;margin-top:14px;display:flex;flex-direction:column;gap:10px">
        <div class="linea-sobre">
          <button type="button" data-accion="cambiarDestinatario" aria-label="${esSanta() ? 'Escribir a los Reyes Magos' : 'Escribir a Santa Claus'}" style="position:absolute;right:-12px;top:-30px;width:44px;height:34px;background:none;border:none;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center">${CAMBIAR}</button>
          <div class="rotulo">Para:</div>
          <div class="valor">${esSanta() ? 'Santa Claus · Polo Norte' : 'SS.MM. Reyes Magos de Oriente'}</div>
        </div>
        <div class="linea-sobre">
          <label class="rotulo" for="remite">De:</label>
          <input id="remite" class="remite" type="email" autocomplete="email" inputmode="email" value="${esc(st.email)}" placeholder="tu correo electrónico">
        </div>
      </div>
    </div></div>
    <button type="button" class="boton" id="btn-correo" data-accion="enviarCorreo" ${ok && !st.ocupado ? '' : 'disabled'}>${st.ocupado ? 'Enviando…' : 'Ir a mi carta'}</button>
    ${st.error ? `<p class="aviso" style="color:#fbf3e8;background:rgba(158,42,43,.85);padding:8px 14px;border-radius:8px">${esc(st.error)}</p>` : ''}
  </div></main>`;
}

function pCodigo() {
  const casillas = [0, 1, 2, 3, 4, 5].map((i) => `<div class="casilla" data-casilla="${i}">${esc(st.codigo[i] || '')}</div>`).join('');
  return `
  <main class="pantalla cuadros"><div class="escena">
    <div class="escala"><div class="reverso">
      <div style="position:absolute;top:10px;left:26px;right:26px;text-align:center;color:#3a2a22;background:#fbf5ea;border-radius:10px;padding:8px 12px;box-shadow:0 3px 8px rgba(40,10,8,.3)">
        <p style="margin:0;font-size:14px;font-weight:600;line-height:1.3">${esSanta() ? 'Los elfos' : 'Los pajes'} te han enviado un código</p>
        <p style="margin:2px 0 0;font-size:12.5px;line-height:1.35;color:#4a3d36">Míralo en ${esc(st.email)} y escríbelo aquí</p>
        <p style="margin:4px 0 0;font-size:12px;line-height:1.35;color:#8e1f20;font-weight:600">⚠️ ¿No llega? Mira en SPAM, es de Willy</p>
      </div>
      <img src="img/${esSanta() ? 'lacre-santa' : 'lacre-reyes'}.png" alt="" aria-hidden="true" style="position:absolute;left:50%;top:104px;width:80px;height:auto;transform:translateX(-50%) rotate(-6deg);filter:drop-shadow(0 4px 6px rgba(40,10,8,.45))">
      <div style="position:absolute;left:0;right:0;top:192px;display:flex;justify-content:center">
        <div style="position:relative;display:flex;gap:8px">
          ${casillas}
          <label for="codigo" class="oculto-accesible">Código de 6 cifras</label>
          <input id="codigo" class="codigo-oculto" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" value="${esc(st.codigo)}">
        </div>
      </div>
    </div></div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:14px">
      <button type="button" class="boton" id="btn-verificar" data-accion="verificar" ${st.codigo.length === 6 && !st.ocupado ? '' : 'disabled'}>${st.ocupado ? 'Comprobando…' : 'Verificar'}</button>
      <div style="display:flex;gap:10px">
        <button type="button" class="boton-sec" data-accion="reenviar">Reenviar código</button>
        <button type="button" class="boton-sec" data-accion="cambiarCorreo">Cambiar correo</button>
      </div>
      ${st.error ? `<p class="aviso" style="color:#fbf3e8;background:rgba(158,42,43,.85);padding:8px 14px;border-radius:8px">${esc(st.error)}</p>` : ''}
    </div>
  </div></main>`;
}

function opcionesFamilia() {
  const ops = [];
  if (st.invitacionNombre) ops.push(['invitacion', st.invitacionNombre]);
  else ops.push(['codigo', 'Tengo un código']);
  ops.push(['nueva', '+ Nueva familia']);
  return ops;
}
function perfilCompleto() {
  const f = st.perfilForm;
  return f.nombre.trim() && f.familia &&
    (f.familia !== 'nueva' || f.nombreFamilia.trim()) &&
    (f.familia !== 'codigo' || f.codigo.trim().length === 8);
}
function pPerfil() {
  const f = st.perfilForm;
  const nueva = f.familia === 'nueva';
  return `
  <main class="pantalla cuadros"><div class="escena" style="gap:28px">
    <div class="escala"><div class="hoja-perfil sombra">
      <div style="position:absolute;left:203px;top:26px;width:146px;height:152px;background:#3b3a38;overflow:hidden">
        ${f.fotoUrl ? `<img src="${esc(f.fotoUrl)}" alt="Tu foto" style="width:100%;height:100%;object-fit:cover;display:block">`
          : `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:#efe6d8;padding:0 22px 0 6px;text-align:center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"></path><circle cx="12" cy="13" r="3.5"></circle></svg>
              <span style="font-size:12px;font-weight:600;line-height:1.25">Sube tu foto</span></div>`}
        <label for="foto" class="oculto-accesible">Subir foto de perfil</label>
        <input id="foto" class="subir" type="file" accept="image/*">
      </div>
      <div class="papel-perfil"></div>
      <div style="position:absolute;left:22px;top:36px;width:134px">
        <div class="maquina" style="font-size:13px;letter-spacing:2.5px">Archivo de</div>
        <div class="grano titulo" style="font-size:23px;line-height:1.15;margin-top:4px">${esSanta() ? 'Santa Claus' : 'Los Reyes Magos'}</div>
        <div style="margin-top:12px;width:100%;border-top:1.5px solid rgba(158,42,43,.55)"></div>
      </div>
      <div style="position:absolute;left:22px;right:22px;top:222px;border:1.2px solid #3a3330;display:flex;flex-direction:column">
        <div class="celda">
          <label for="p-nombre" class="maquina">Nombre:</label>
          <input id="p-nombre" class="campo-ficha" data-campo="nombre" type="text" autocomplete="given-name" maxlength="60" value="${esc(f.nombre)}" placeholder="¿Cómo te llaman en casa?">
        </div>
        <div class="celda">
          <label for="p-emoji" class="maquina">Emoji:</label>
          <div style="display:flex;align-items:center;gap:12px;padding-top:4px">
            <input id="p-emoji" class="emoji ${f.emoji ? 'puesto' : ''}" type="text" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" value="${esc(f.emoji)}" placeholder="+" aria-describedby="emoji-ayuda">
            <span id="emoji-ayuda" class="maquina" style="font-size:12px;line-height:1.3;text-transform:none;letter-spacing:0;color:rgba(58,51,48,.8)">${f.emoji ? 'Toca para cambiarlo' : 'Toca el + y elige uno del teclado de emojis'}</span>
          </div>
        </div>
        <div class="celda">
          <span class="maquina" id="familia-etiqueta">Familia:</span>
          <div role="radiogroup" aria-labelledby="familia-etiqueta" style="display:flex;align-items:center;flex-wrap:wrap;gap:6px 22px;padding:10px 6px 6px">
            ${opcionesFamilia().map(([id, nombre]) => `<button type="button" role="radio" class="opcion-familia" data-accion="elegirFamilia" data-valor="${id}" aria-checked="${f.familia === id}">${CIRCULO}${esc(nombre)}</button>`).join('')}
          </div>
        </div>
        ${nueva ? `<div class="celda">
          <label for="p-nfam" class="maquina">Nombre de la familia:</label>
          <input id="p-nfam" class="campo-ficha" data-campo="nombreFamilia" type="text" maxlength="80" value="${esc(f.nombreFamilia)}" placeholder="Ej.: Familia García López">
        </div>` : ''}
        ${f.familia === 'codigo' ? `<div class="celda">
          <label for="p-cod" class="maquina">Código de tu familia:</label>
          <input id="p-cod" class="campo-ficha" data-campo="codigo" type="text" autocapitalize="characters" maxlength="8" value="${esc(f.codigo)}" placeholder="8 letras y números" style="font-family:'Courier Prime',monospace;font-size:20px;letter-spacing:3px;text-transform:uppercase">
        </div>` : ''}
      </div>
    </div></div>
    <button type="button" class="boton" id="btn-perfil" data-accion="guardarPerfil" ${perfilCompleto() && !st.ocupado ? '' : 'disabled'}>${st.ocupado ? 'Guardando…' : (nueva ? 'Solicitar acceso' : 'Guardar perfil')}</button>
    ${st.error ? `<p class="aviso" style="color:#fbf3e8;background:rgba(158,42,43,.85);padding:8px 14px;border-radius:8px">${esc(st.error)}</p>` : ''}
  </div></main>`;
}

function pMensaje(titulo, texto, boton, accion) {
  return `
  <main class="pantalla cuadros"><div class="escena">
    <div class="sello mensaje-central" role="dialog" aria-labelledby="msg-t">
      <h1 id="msg-t" class="grano titulo" style="margin:0;font-size:26px;line-height:1.2">${titulo}</h1>
      <p style="margin:0;font-size:15px;line-height:1.45;color:#3a2a22">${texto}</p>
      ${boton ? `<button type="button" class="boton" style="margin-top:6px;min-height:46px;padding:0 26px" data-accion="${accion}">${boton}</button>` : ''}
    </div>
  </div></main>`;
}
const pEspera = () => pMensaje('Solicitud enviada',
  `${esSanta() ? 'Santa revisará' : 'Los Reyes revisarán'} tu solicitud para «${esc(st.solicitud?.nombre_familia || '')}». Te avisaremos por correo en cuanto tu familia esté lista.`,
  'Salir', 'salir');
const pDormido = () => pMensaje('El taller descansa',
  'Los elfos están de vacaciones. La carta vuelve a abrirse el 1 de noviembre: ¡pórtate bien hasta entonces!', 'Salir', 'salir');

function menu(activa) {
  if (!st.perfil || rolNivel(st.perfil.rol) < 2) return '';
  const items = [
    { id: 'carta', nombre: 'Mi carta', icono: 'pins-carta.png', alto: 26 },
    { id: 'taller', nombre: 'Taller', icono: 'pins-taller.png', alto: 34 }
  ];
  return `<nav class="menu papel-sin-sombra" aria-label="Menú principal">
    ${items.map((x) => {
      const on = x.id === activa;
      return `<button type="button" class="pestana" data-accion="ir" data-valor="${x.id}" ${on ? 'aria-current="page"' : ''}>
        <img src="img/${x.icono}" alt="" aria-hidden="true" style="height:${on ? Math.round(x.alto * 1.3) : x.alto}px">
        <span class="maquina">${x.nombre}</span></button>`;
    }).join('')}
  </nav>`;
}

function pCarta() {
  const santa = esSanta();
  const portado = st.carta ? st.carta.portado : 75;
  const activa = Math.round(portado / 25);
  const caras = CARAS.map((c, i) => `
    <button type="button" class="cara" data-accion="portado" data-valor="${i * 25}" aria-label="${c.nombre}" aria-pressed="${i === activa}" style="left:calc(13px + (100% - 26px) * ${i / 4})">
      <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="${c.color}"></circle><ellipse cx="15" cy="16" rx="1.8" ry="2.6" fill="#2b2320"></ellipse><ellipse cx="25" cy="16" rx="1.8" ry="2.6" fill="#2b2320"></ellipse><path d="${c.boca}" fill="none" stroke="#2b2320" stroke-width="2.2" stroke-linecap="round"></path></svg>
    </button>`).join('');
  const deseos = st.deseos.map((d) => `
    <div class="renglon"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="flex-shrink:0;margin-bottom:5px">${ESTRELLA}</svg>
      <button type="button" class="deseo" data-accion="editarDeseo" data-valor="${d.id}">${esc(d.nombre)}</button></div>`).join('');
  const vacios = Array.from({ length: Math.max(0, 8 - st.deseos.length) }, () =>
    `<div class="renglon" style="padding-bottom:8px"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="opacity:.28">${ESTRELLA}</svg></div>`).join('');

  return `
  <main class="pantalla">
    <div class="carta carta-papel">
      <button type="button" class="salir" data-accion="salir">Salir</button>
      <div class="carta-dentro">
        <div style="display:flex;flex-direction:column;align-items:center;padding-top:2px">
          <div style="height:64px;display:flex;align-items:flex-end;justify-content:center;margin-bottom:10px">
            <img src="img/${santa ? 'santa' : 'reyes'}.png" alt="${santa ? 'Papá Noel en su trineo con renos' : 'Los Reyes Magos con su camello'}" style="height:60px;width:auto;display:block">
          </div>
          <h1 class="grano titulo" style="margin:0 0 6px;font-size:21px;letter-spacing:.2px;white-space:nowrap;text-align:center">${santa ? 'Querido Santa Claus' : 'Queridos Reyes Magos'}</h1>
        </div>
        <div style="display:flex;flex-direction:column">
          <div class="renglon"><span class="mano">Este año me he portado…</span></div>
          <div style="height:80px;display:flex;flex-direction:column;justify-content:flex-end;padding:0 2px 3px;gap:2px">
            <div style="position:relative;height:42px">${caras}</div>
            <label for="portado" class="oculto-accesible">¿Cómo te has portado?</label>
            <input id="portado" class="portado" type="range" min="0" max="100" step="25" value="${portado}" aria-valuetext="${CARAS[activa].nombre}">
          </div>
          <div class="renglon"><span class="mano">Así que ${santa ? 'te quiero pedir:' : 'os quiero pedir:'}</span></div>
          ${deseos}
          <div class="renglon"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="flex-shrink:0;margin-bottom:9px">${ESTRELLA}</svg>
            <button type="button" class="anadir" data-accion="nuevoDeseo">${st.deseos.length ? 'Pulsa para añadir otro regalo' : 'Pulsa para añadir regalo'}</button></div>
          ${vacios}
        </div>
        <button type="button" class="boton" style="margin-top:22px;align-self:center;min-height:48px;padding:0 30px;box-shadow:0 3px 0 #6e1c1d" data-accion="guardarCarta">${st.cartaGuardada ? 'Carta guardada ✓' : 'Guardar carta'}</button>
        ${st.error ? `<p class="aviso" style="margin-top:10px">${esc(st.error)}</p>` : ''}
      </div>
      ${st.ficha ? pFicha() : ''}
      ${st.popup ? `<div class="velo"><div class="sello" role="dialog" aria-modal="true" aria-labelledby="popup-t">
        <h2 id="popup-t" class="grano titulo" style="margin:0;font-size:27px;line-height:1.2">Feliz Navidad ${anioNavidad()}</h2>
        <p style="margin:0;font-size:16px;line-height:1.4;color:#3a2a22">¿Te has portado bien este año?</p>
        <button type="button" class="boton" style="margin-top:6px;min-height:46px;padding:0 26px;box-shadow:0 3px 0 #6e1c1d" data-accion="cerrarPopup">Hacer mi carta</button>
      </div></div>` : ''}
    </div>
    ${menu('carta')}
  </main>`;
}

function pFicha() {
  const f = st.ficha;
  const campo = (id, etiqueta, valor, extra = '') => `
    <div style="display:flex;flex-direction:column;gap:2px">
      <label for="f-${id}" class="etiqueta">${etiqueta}</label>
      <input id="f-${id}" class="campo" data-ficha="${id}" type="${id === 'enlace' ? 'url' : 'text'}" value="${esc(valor)}" ${extra}>
    </div>`;
  return `
  <div class="velo">
    <form class="ficha" role="dialog" aria-modal="true" aria-labelledby="ficha-t" data-form="ficha" novalidate>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <h2 id="ficha-t" class="grano titulo" style="margin:0;font-size:22px">${f.id ? 'Mi regalo' : 'Nuevo regalo'}</h2>
        <button type="button" data-accion="cerrarFicha" aria-label="Cerrar" style="width:44px;height:44px;margin:-8px -10px -8px 0;background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b5d56" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12"></path><path d="M18 6 6 18"></path></svg>
        </button>
      </div>
      ${campo('nombre', '¿Qué quieres pedir? <span style="color:#9e2a2b">*</span>', f.nombre, 'maxlength="120" placeholder="Ej.: Sudadera azul"')}
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px">
        ${campo('tienda', 'Tienda', f.tienda, 'placeholder="¿Dónde?"')}
        ${campo('talla', 'Talla', f.talla, 'placeholder="M, 42…"')}
      </div>
      ${campo('enlace', 'Enlace', f.enlace, 'placeholder="https://…" style="font-family:Inter,sans-serif;font-size:15px"')}
      <div style="display:flex;flex-direction:column;gap:2px">
        <label for="f-obs" class="etiqueta">Más pistas</label>
        <textarea id="f-obs" class="campo" data-ficha="observaciones" rows="3" placeholder="Color, modelo… cuanto más concreto, más ${esSanta() ? 'acierta Santa' : 'aciertan los Reyes'}" style="resize:none;line-height:30px;background-image:repeating-linear-gradient(to bottom,transparent 0,transparent 29px,rgba(120,92,76,.32) 29px,rgba(120,92,76,.32) 30px);border-bottom:none">${esc(f.observaciones)}</textarea>
      </div>
      <button type="submit" class="boton" id="btn-regalo" style="margin-top:4px;align-self:center;min-height:48px;padding:0 30px;box-shadow:0 3px 0 #6e1c1d" ${f.nombre.trim() && !st.ocupado ? '' : 'disabled'}>Guardar regalo</button>
      ${f.id ? `<button type="button" class="boton-sec" style="align-self:center" data-accion="borrarDeseo">Quitar de mi carta</button>` : ''}
    </form>
  </div>`;
}

function pTaller() {
  const t = st.taller;
  if (!t) return `<main class="pantalla corcho"><div class="cargando">Abriendo el taller…</div>${menu('taller')}</main>`;
  const ahora = hoy();
  const proxima = (mes, dia) => { let d = new Date(ahora.getFullYear(), mes, dia); if (d <= ahora) d = new Date(ahora.getFullYear() + 1, mes, dia); return d; };
  const tablero = (titulo, fecha) => {
    const dias = Math.ceil((fecha - ahora) / 86400000);
    const dig = String(dias).padStart(2, '0').split('');
    return `<div class="tablero" role="timer" aria-label="Faltan ${dias} días para ${titulo}">
      <div class="maquina" style="font-size:10.5px;color:#f3e9d6;text-align:center;letter-spacing:2.5px;margin-bottom:10px">${titulo}</div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
        <div style="display:flex;gap:5px">${dig.map((d) => `<span class="ficha-digito">${d}</span>`).join('')}</div>
        <span class="maquina" style="font-size:9.5px;color:#f3e9d6;letter-spacing:1.5px">${dias === 1 ? 'día' : 'días'}</span>
      </div></div>`;
  };
  const malos = (t.ninos || []).filter((n) => n.n < 3);
  const elfos = t.elfos || [];
  const conHechos = elfos.filter((e) => e.hechos > 0).sort((a, b) => b.hechos - a.hechos);
  const pendientes = elfos.filter((e) => e.asignados - e.hechos > 0).sort((a, b) => (b.asignados - b.hechos) - (a.asignados - a.hechos)).slice(0, 3);
  const asignados = elfos.reduce((s, e) => s + e.asignados, 0);
  const nom = (x) => `${x.emoji ? esc(x.emoji) + ' ' : ''}${esc(x.nombre)}`;
  const fav = conHechos[0];

  return `
  <main class="pantalla corcho">
    <div class="taller-scroll">
      <div style="position:relative;align-self:center;width:300px;height:149px">
        <img src="img/cartel.png" alt="El Taller" style="width:100%;height:auto;display:block;filter:drop-shadow(0 6px 10px rgba(40,22,10,.4))">
        <div class="maquina" style="position:absolute;left:0;right:0;top:118px;text-align:center;font-size:${(t.familia || '').length > 22 ? 10.5 : 13.5}px;letter-spacing:2px;color:#1f4a35">${esc(t.familia)}</div>
      </div>
      <div style="display:flex;justify-content:center;align-items:flex-start;gap:15px;margin-top:-14px">
        ${tablero('Navidad', proxima(11, 25))}${tablero('Reyes', proxima(0, 6))}
      </div>

      <div class="papel nota" style="position:relative;transform:rotate(1.2deg)">
        <img src="img/washi-partitura.png" alt="" aria-hidden="true" style="position:absolute;left:50%;top:-12px;width:130px;height:auto;transform:translateX(-50%) rotate(2deg)">
        <div style="display:flex;gap:8px">
          <div style="flex:1;min-width:0">
            <h2 class="grano titulo">Lista de niños malos</h2>
            <div class="maquina" style="font-size:10.5px;margin-top:4px">Añade regalos a tu carta para salir de la lista</div>
            <div style="margin-top:12px;display:flex;flex-direction:column;gap:4px">
              ${malos.map((m) => `<div class="fila"><span class="mano">${nom(m)}</span><span class="maquina" style="color:#9e2a2b">${reg(m.n)}</span></div>`).join('')}
              ${malos.length ? '' : '<p class="vacio">¡Nadie en la lista! Este año todos se han portado bien.</p>'}
            </div>
          </div>
          <img src="img/grinch.png" alt="Un duende verde con gorro de Papá Noel y un perrito con cuernos de reno" style="width:78px;height:auto;align-self:flex-end">
        </div>
      </div>

      <div style="position:relative">
        <div class="detras" aria-hidden="true" style="background-color:#3d6b4a;transform:rotate(2.5deg)"></div>
        <div class="papel nota" style="position:relative;transform:rotate(-1deg)">
          <span class="chincheta oro" style="left:50%;top:-6px;margin-left:-9px"></span>
          <h2 class="grano titulo">Ranking de elfos</h2>
          ${fav ? `
          <div style="margin-top:14px;display:flex;align-items:center;gap:14px;padding-bottom:12px;border-bottom:1px dashed rgba(110,88,72,.5)">
            <img src="img/campana.png" alt="" aria-hidden="true" style="width:54px;height:auto">
            <div style="display:flex;flex-direction:column;gap:1px">
              <span class="maquina" style="font-size:10.5px;color:#9e2a2b;font-weight:700">Elfo favorito</span>
              <span class="mano" style="font-size:30px;line-height:1">${nom(fav)}</span>
              <span class="maquina" style="font-size:10.5px">${reg(fav.hechos)} completados</span>
            </div>
          </div>
          <div class="maquina" style="font-size:11px;margin-top:12px;font-weight:700">Los mejores</div>
          <div style="margin-top:6px;display:flex;flex-direction:column;gap:4px">
            ${conHechos.slice(0, 3).map((e, i) => `<div class="fila" style="justify-content:flex-start"><span class="maquina" style="font-size:12px;width:24px;color:#9e2a2b;font-weight:700">${i + 1}º</span><span class="mano" style="flex:1">${nom(e)}</span><span class="maquina">${reg(e.hechos)}</span></div>`).join('')}
          </div>` : `
          <div style="margin-top:12px;display:flex;align-items:center;gap:14px">
            <img src="img/campana.png" alt="" aria-hidden="true" style="width:46px;height:auto;flex-shrink:0">
            <p class="vacio" style="margin:0">Aún no hay elfo favorito: el primero que complete un regalo se lleva el puesto.</p>
          </div>`}
        </div>
      </div>

      <div style="position:relative;margin-left:14px">
        <div class="detras" aria-hidden="true" style="background-color:#a8332f;transform:rotate(-3deg)"></div>
        <div class="papel nota" style="position:relative;transform:rotate(1deg)">
          <span class="chincheta" style="right:152px;top:-5px"></span>
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
            <div><h2 class="grano titulo">Necesitan ayuda</h2><div class="maquina" style="font-size:10.5px;margin-top:4px">Más regalos pendientes</div></div>
            <img src="img/regalo-rojo.png" alt="" aria-hidden="true" style="width:46px;height:auto">
          </div>
          <div style="margin-top:10px;display:flex;flex-direction:column;gap:4px">
            ${pendientes.map((e) => `<div class="fila"><span class="mano">${nom(e)}</span><span class="maquina" style="color:#9e2a2b">${e.asignados - e.hechos} pendientes</span></div>`).join('')}
            ${pendientes.length ? '' : `<p class="vacio">${asignados === 0 ? 'Todavía no hay regalos asignados a ningún elfo.' : '¡Ningún elfo tiene regalos pendientes! Buen trabajo.'}</p>`}
          </div>
        </div>
      </div>

      <div class="papel" style="position:relative;padding:26px 20px 20px;transform:rotate(-1.2deg);margin-top:6px">
        <img src="img/washi-acebo.png" alt="" aria-hidden="true" style="position:absolute;left:50%;top:-12px;width:150px;height:auto;transform:translateX(-50%) rotate(-3deg);opacity:.95">
        <h2 class="grano titulo" style="margin:0;font-size:21px">Estadísticas</h2>
        <div style="margin-top:12px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;text-align:center">
          ${[[t.total, 'Regalos en las cartas'], [t.sin_empezar, 'Sin empezar'], [t.completados, 'Completados']].map(([v, txt]) => `
            <div style="display:flex;flex-direction:column;align-items:center;gap:2px"><span class="grano titulo" style="font-size:30px;line-height:1.1">${v ?? 0}</span><span class="maquina" style="font-size:9.5px;line-height:1.3">${txt}</span></div>`).join('')}
        </div>
      </div>
    </div>
    ${menu('taller')}
  </main>`;
}

// ---------- Render ----------
const pantallas = {
  cargando: () => '<main class="pantalla cuadros"><div class="cargando">Abriendo el buzón…</div></main>',
  sobre: pSobre, codigo: pCodigo, perfil: pPerfil, espera: pEspera, dormido: pDormido, carta: pCarta, taller: pTaller
};
function render() {
  const activo = document.activeElement && document.activeElement.id;
  app.innerHTML = pantallas[st.pantalla]();
  ajustarEscala();
  if (activo) { const el = document.getElementById(activo); if (el) { el.focus(); if (el.setSelectionRange && el.type !== 'email' && el.type !== 'range') { const n = el.value.length; try { el.setSelectionRange(n, n); } catch (e) {} } } }
}

// ---------- Acciones ----------
const acciones = {
  cambiarDestinatario() {
    st.destinatario = esSanta() ? 'reyes' : 'santa';
    st.destElegido = true;
    localStorage.setItem('destinatario', st.destinatario);
    render();
  },
  async enviarCorreo() {
    const email = st.email.trim().toLowerCase();
    st.ocupado = true; st.error = ''; render();
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    st.ocupado = false;
    if (error) return fallo(error, /rate|seconds/i.test(error.message) ? 'Espera un minuto antes de pedir otro código.' : 'No hemos podido enviar el correo. Revisa la dirección.');
    st.email = email; localStorage.setItem('email', email);
    st.codigo = ''; st.destElegido = true;
    ir('codigo');
    setTimeout(() => document.getElementById('codigo')?.focus(), 50);
  },
  async verificar() {
    if (st.ocupado || st.codigo.length !== 6) return;
    st.ocupado = true; st.error = ''; render();
    const { error } = await sb.auth.verifyOtp({ email: st.email, token: st.codigo, type: 'email' });
    st.ocupado = false;
    if (error) { st.codigo = ''; return fallo(error, 'Ese código no es correcto o ha caducado.'); }
    await cargar().catch((e) => fallo(e));
  },
  async reenviar() {
    const { error } = await sb.auth.signInWithOtp({ email: st.email, options: { shouldCreateUser: true } });
    st.error = error ? 'Espera un minuto antes de pedir otro código.' : '';
    render();
    if (!error) { st.error = ''; }
  },
  cambiarCorreo() { st.codigo = ''; ir('sobre'); },
  elegirFamilia(v) { st.perfilForm.familia = v; render(); },
  async guardarPerfil() {
    const f = st.perfilForm;
    st.ocupado = true; st.error = ''; render();
    try {
      if (f.familia === 'nueva') {
        const { error } = await sb.rpc('solicitar_familia', { p_nombre_familia: f.nombreFamilia.trim(), p_nombre_persona: f.nombre.trim() });
        if (error) throw error;
        st.ocupado = false;
        st.solicitud = { nombre_familia: f.nombreFamilia.trim() };
        return ir('espera');
      }
      const codigo = f.familia === 'invitacion' ? st.invitacion : f.codigo.trim().toUpperCase();
      const { data: perfilId, error } = await sb.rpc('unirse_familia', { p_codigo: codigo, p_nombre: f.nombre.trim() });
      if (error) throw error;
      let fotoUrl = '';
      if (f.foto) fotoUrl = await subirFoto(f.foto);
      await sb.rpc('actualizar_mi_perfil', { p_perfil: perfilId, p_nombre: f.nombre.trim(), p_emoji: f.emoji, p_foto: fotoUrl });
      localStorage.setItem('perfil', perfilId);
      localStorage.removeItem('invitacion'); st.invitacion = '';
      st.destElegido = true;
      st.ocupado = false;
      await cargar();
    } catch (e) {
      fallo(e, /no válido/i.test(e.message || '') ? 'Ese código de familia no existe. Revísalo con tu jefe.' : (/pendiente/i.test(e.message || '') ? 'Ya tienes una solicitud pendiente.' : 'No hemos podido guardar tu perfil.'));
    }
  },
  cerrarPopup() { st.popup = false; render(); },
  async portado(v) {
    st.carta = Object.assign({ destinatario: st.destinatario }, st.carta || {}, { portado: Number(v) });
    render();
    await guardarCarta(false);
  },
  async guardarCarta() { await guardarCarta(true); },
  nuevoDeseo() { st.ficha = { id: null, nombre: '', tienda: '', talla: '', enlace: '', observaciones: '' }; render(); setTimeout(() => document.getElementById('f-nombre')?.focus(), 30); },
  editarDeseo(id) {
    const d = st.deseos.find((x) => x.id === id);
    if (d) { st.ficha = { id: d.id, nombre: d.nombre || '', tienda: d.tienda || '', talla: d.talla || '', enlace: d.enlace || '', observaciones: d.observaciones || '' }; render(); }
  },
  cerrarFicha() { st.ficha = null; render(); },
  async borrarDeseo() {
    if (!st.ficha?.id) return;
    st.ocupado = true;
    const { error } = await sb.rpc('borrar_deseo', { p_id: st.ficha.id });
    st.ocupado = false;
    if (error) return fallo(error, 'No hemos podido quitar el regalo.');
    st.ficha = null;
    await cargarCarta(); st.popup = false; render();
  },
  async ir(v) {
    if (v === 'taller') {
      st.taller = null; ir('taller');
      const { data, error } = await sb.rpc('taller', { p_familia: st.perfil.familia_id });
      if (error) return fallo(error, 'No hemos podido abrir el taller.');
      st.taller = data; render();
    } else { ir('carta'); }
  },
  async salir() {
    await sb.auth.signOut();
    localStorage.removeItem('perfil');
    Object.assign(st, { perfil: null, perfiles: [], carta: null, deseos: [], taller: null, codigo: '' });
    ir('sobre');
  }
};

async function guardarCarta(avisar) {
  const portado = st.carta ? st.carta.portado : 75;
  const { error } = await sb.rpc('guardar_carta', { p_perfil: st.perfil.id, p_portado: portado, p_destinatario: st.destinatario });
  if (error) return fallo(error, 'No hemos podido guardar tu carta.');
  st.carta = Object.assign({}, st.carta || {}, { portado, destinatario: st.destinatario, guardada_en: new Date().toISOString() });
  if (avisar) { st.cartaGuardada = true; render(); setTimeout(() => { st.cartaGuardada = false; if (st.pantalla === 'carta') render(); }, 2500); }
}

async function guardarRegalo() {
  const f = st.ficha;
  if (!f || !f.nombre.trim()) return;
  st.ocupado = true;
  const args = { p_nombre: f.nombre, p_tienda: f.tienda, p_talla: f.talla, p_enlace: f.enlace, p_observaciones: f.observaciones };
  const { error } = f.id
    ? await sb.rpc('editar_deseo', Object.assign({ p_id: f.id }, args))
    : await sb.rpc('crear_deseo', Object.assign({ p_perfil: st.perfil.id }, args));
  st.ocupado = false;
  if (error) return fallo(error, 'No hemos podido guardar el regalo.');
  st.ficha = null;
  await cargarCarta(); st.popup = false; render();
}

async function subirFoto(file) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const lado = 600, k = Math.min(1, lado / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
  const ruta = `${st.uid}/${Date.now()}.jpg`;
  const { error } = await sb.storage.from('fotos').upload(ruta, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) { console.error(error); return ''; }
  return sb.storage.from('fotos').getPublicUrl(ruta).data.publicUrl;
}

// ---------- Eventos ----------
app.addEventListener('click', (e) => {
  const b = e.target.closest('[data-accion]');
  if (!b || b.disabled) return;
  const fn = acciones[b.dataset.accion];
  if (fn) { e.preventDefault(); Promise.resolve(fn(b.dataset.valor)).catch((err) => fallo(err)); }
});

app.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'remite') {
    st.email = t.value;
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.value.trim());
    const btn = document.getElementById('btn-correo'); if (btn) btn.disabled = !ok || st.ocupado;
  } else if (t.id === 'codigo') {
    st.codigo = t.value.replace(/\D/g, '').slice(0, 6);
    t.value = st.codigo;
    document.querySelectorAll('[data-casilla]').forEach((c, i) => { c.textContent = st.codigo[i] || ''; c.classList.toggle('casilla-activa', i === Math.min(st.codigo.length, 5)); });
    const btn = document.getElementById('btn-verificar'); if (btn) btn.disabled = st.codigo.length !== 6;
    if (st.codigo.length === 6) acciones.verificar();
  } else if (t.dataset.campo) {
    let v = t.value;
    if (t.dataset.campo === 'codigo') { v = v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); t.value = v; }
    st.perfilForm[t.dataset.campo] = v;
    const btn = document.getElementById('btn-perfil'); if (btn) btn.disabled = !perfilCompleto();
  } else if (t.id === 'p-emoji') {
    const g = ultimoGrafema(t.value);
    st.perfilForm.emoji = g; t.value = g;
    t.classList.toggle('puesto', !!g);
    const ayuda = document.getElementById('emoji-ayuda'); if (ayuda) ayuda.textContent = g ? 'Toca para cambiarlo' : 'Toca el + y elige uno del teclado de emojis';
  } else if (t.dataset.ficha) {
    st.ficha[t.dataset.ficha] = t.value;
    const btn = document.getElementById('btn-regalo'); if (btn) btn.disabled = !st.ficha.nombre.trim();
  }
});

app.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'portado') acciones.portado(t.value);
  else if (t.id === 'foto' && t.files && t.files[0]) {
    st.perfilForm.foto = t.files[0];
    st.perfilForm.fotoUrl = URL.createObjectURL(t.files[0]);
    render();
  }
});

app.addEventListener('focusin', (e) => {
  if (e.target.id === 'codigo') document.querySelectorAll('[data-casilla]').forEach((c, i) => c.classList.toggle('casilla-activa', i === Math.min(st.codigo.length, 5)));
});
app.addEventListener('focusout', (e) => {
  if (e.target.id === 'codigo') document.querySelectorAll('[data-casilla]').forEach((c) => c.classList.remove('casilla-activa'));
});

app.addEventListener('submit', (e) => {
  if (e.target.dataset.form === 'ficha') { e.preventDefault(); guardarRegalo(); }
});
app.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'remite') { const b = document.getElementById('btn-correo'); if (b && !b.disabled) acciones.enviarCorreo(); }
  if (e.key === 'Escape' && st.ficha) acciones.cerrarFicha();
});

// ---------- Arranque ----------
sb.auth.onAuthStateChange((evento) => { if (evento === 'SIGNED_OUT' && st.pantalla !== 'sobre') ir('sobre'); });
// Vista previa sin conexión: añade ?demo=sobre|codigo|perfil|carta|taller|espera|dormido a la dirección
const demo = new URL(location.href).searchParams.get('demo');
if (demo) {
  st.uid = 'demo';
  st.perfil = { id: 'demo', nombre: 'Willy', rol: 'jefe', familia_id: 'demo', familias: { nombre: 'Lobera Calvo' } };
  st.deseos = [{ id: 'a', nombre: 'Sudadera de Scuffers', tienda: 'Scuffers', talla: 'XL' }, { id: 'b', nombre: 'Zapas guapas verdes' }];
  st.carta = { portado: 75, destinatario: 'reyes' };
  st.invitacionNombre = 'Lobera Calvo'; st.perfilForm.familia = 'invitacion';
  st.solicitud = { nombre_familia: 'Familia García' };
  st.taller = { familia: 'Familia Lobera Calvo', ninos: [{ nombre: 'Alvarito', emoji: '🎅', n: 1 }, { nombre: 'Cande', n: 6 }],
    elfos: [{ nombre: 'Willy', emoji: '🎅', asignados: 31, hechos: 26 }, { nombre: 'Blanqui', asignados: 27, hechos: 25 }, { nombre: 'Mamita', emoji: '🤶', asignados: 20, hechos: 17 }],
    total: 106, sin_empezar: 12, completados: 66 };
  ir(demo);
} else {
  cargar().catch((e) => fallo(e));
}
