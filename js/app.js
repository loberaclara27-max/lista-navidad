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
  solicitud: null,
  ninos: [],
  cartaDe: null
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
  const z = app.querySelector('.zona-tarjeta');
  if (z) {
    const peq = z.classList.contains('pequena');
    const k2 = Math.max(.55, Math.min(1.12, (z.clientHeight - 6) / (peq ? 388 : 429), (z.clientWidth - 30) / (peq ? 262 : 290)));
    z.style.setProperty('--kt', k2.toFixed(3));
  }
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
    if (sol && sol.length) {
      st.solicitud = sol[0];
      clearTimeout(st.vigilaEspera);
      st.vigilaEspera = setTimeout(() => { if (st.pantalla === 'espera') cargar(); }, 20000);
      return ir('espera');
    }
    await prepararPerfil();
    return ir('perfil');
  }

  const guardado = localStorage.getItem('perfil');
  st.perfil = st.perfiles.find((p) => p.id === guardado) || st.perfiles[0];
  localStorage.setItem('perfil', st.perfil.id);
  const { data: ninos } = await sb.from('perfiles').select('id,nombre,emoji,foto_url').eq('gestionado_por', st.perfil.id).order('creado_en');
  st.ninos = ninos || [];
  st.cartaDe = null;
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

const perfilCarta = () => (st.cartaDe && st.ninos.find((n) => n.id === st.cartaDe)) || st.perfil;
async function cargarCarta() {
  const p = perfilCarta();
  const [{ data: deseos, error: e1 }, { data: cartas }] = await Promise.all([
    sb.rpc('mi_carta', { p_perfil: p.id }),
    sb.from('cartas').select('portado,destinatario,guardada_en').eq('perfil_id', p.id).eq('temporada', temporada())
  ]);
  if (e1) throw e1;
  st.deseos = deseos || [];
  st.carta = (cartas && cartas[0]) || null;
  if (st.destElegido && !st.cartaDe) {
    await sb.rpc('guardar_carta', { p_perfil: p.id, p_portado: st.carta ? st.carta.portado : 75, p_destinatario: st.destinatario });
    st.carta = Object.assign({ portado: 75 }, st.carta || {}, { destinatario: st.destinatario });
    st.destElegido = false;
  } else if (st.carta) {
    st.destinatario = st.carta.destinatario;
    if (!st.cartaDe) localStorage.setItem('destinatario', st.destinatario);
  }
  st.popup = !st.cartaDe && !st.carta && st.deseos.length === 0;
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
      <div style="position:relative;border:1.2px solid #3a3330;display:flex;flex-direction:column">
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
          <div role="radiogroup" aria-labelledby="familia-etiqueta" style="display:flex;align-items:center;flex-wrap:wrap;gap:6px 18px;padding:10px 8px 6px">
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
  `${esSanta() ? 'Santa revisará' : 'Los Reyes revisarán'} tu solicitud para «${esc(st.solicitud?.nombre_familia || '')}». Suele tardar menos de un día. Si dejas esta pantalla abierta, entrarás sola en cuanto te aprueben; si la cierras, vuelve a abrir la app más tarde.`);
const pDormido = () => pMensaje('El taller descansa',
  'Los elfos están de vacaciones. La carta vuelve a abrirse el 1 de noviembre: ¡pórtate bien hasta entonces!', 'Salir', 'salir');

function menu(activa) {
  if (!st.perfil || rolNivel(st.perfil.rol) < 2) return '';
  const items = [
    { id: 'carta', nombre: 'Mi carta', icono: 'pins-carta.png', alto: 26 },
    { id: 'casa', nombre: 'Mi casa', icono: 'pins-casa.png', alto: 32, jefe: true },
    { id: 'tareas', nombre: 'Mis tareas', icono: 'pins-tareas.png', alto: 32 },
    { id: 'taller', nombre: 'Taller', icono: 'pins-taller.png', alto: 34 }
  ].filter((x) => !x.jefe || st.perfil.rol === 'jefe');
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
      ${st.cartaDe
        ? `<button type="button" id="candado" class="candado" aria-label="Salir de la carta de ${esc(perfilCarta().nombre)}: mantén pulsado">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg></button>`
        : '<button type="button" class="salir" data-accion="salir">Salir</button>'}
      <div class="carta-dentro">
        ${st.ninos.length && !st.cartaDe ? `<div class="selector-cartas" role="tablist" aria-label="¿De quién es la carta?">
          <button type="button" role="tab" aria-selected="true">✉️ Mi carta</button>
          ${st.ninos.map((n) => `<button type="button" role="tab" aria-selected="false" data-accion="abrirCartaNino" data-valor="${n.id}">${esc(n.emoji || '🧒')} ${esc(n.nombre)}</button>`).join('')}
        </div>` : ''}
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
    ${st.cartaDe ? '' : menu('carta')}
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
  sobre: pSobre, codigo: pCodigo, perfil: pPerfil, espera: pEspera, dormido: pDormido, carta: pCarta, taller: pTaller, tareas: pTareas, casa: pCasa
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
        const foto = f.foto ? await subirFoto(f.foto) : '';
        const { error } = await sb.rpc('solicitar_familia', { p_nombre_familia: f.nombreFamilia.trim(), p_nombre_persona: f.nombre.trim(), p_emoji: f.emoji || null, p_foto: foto || null });
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
  async abrirCartaNino(id) {
    st.cartaDe = id; st.ficha = null;
    await cargarCarta(); st.popup = false; render();
  },
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
    } else if (v === 'tareas' || v === 'casa') {
      if (v === 'casa' && st.perfil.rol !== 'jefe') return;
      st.fam = null; ir(v);
      try { await cargarFamilia(); } catch (e) { return fallo(e, 'No hemos podido cargar los regalos.'); }
      render();
    } else { st.cartaDe = null; await cargarCarta(); ir('carta'); }
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
  const { error } = await sb.rpc('guardar_carta', { p_perfil: perfilCarta().id, p_portado: portado, p_destinatario: st.destinatario });
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
    : await sb.rpc('crear_deseo', Object.assign({ p_perfil: perfilCarta().id }, args));
  st.ocupado = false;
  if (error) return fallo(error, 'No hemos podido guardar el regalo.');
  st.ficha = null;
  await cargarCarta(); st.popup = false; render();
}

// ---------- Datos de la familia (tareas y casa) ----------
const ROL = { jefe: ['Jefe', '#6b4f0e', '#f3e6c4'], elfo: ['Elfo', '#1f4a35', '#d6eadc'], nino: ['Niño', '#2f3a5c', '#dde4f3'], familiar: ['Familiar', '#5e4f48', '#e6e1dc'] };
const EST = { pendiente: ['Sin empezar', '#8e1f20', '#f6dcdc'], pedido: ['Pedido', '#2f3a5c', '#dde4f3'], en_casa: ['Conseguido', '#1f4a35', '#d6eadc'], envuelto: ['Envuelto', '#6b4f0e', '#f3e6c4'], entregado: ['Entregado', '#5e4f48', '#e6e1dc'] };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CIRCULO_ROJO = CIRCULO.replace('#3a3330', '#9e2a2b');
const CERRAR = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>';
const FLECHA_ATRAS = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6"></path></svg>';
const MAS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>';
const ENLACE_ICONO = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"></path></svg>';

st.fam = null;          // { perfiles, ocasiones, regalos, codigo }
st.tareas = { pestana: 'adoptar', sub: 'elfo', saltados: [], ficha: null, nuevo: null, saliendo: '' };
st.casa = { pestana: 'familia', persona: null, ocasion: null, hoja: null, copiado: false };

async function cargarFamilia() {
  const fam = st.perfil.familia_id;
  const [p, o, r, f] = await Promise.all([
    sb.from('perfiles').select('id,nombre,emoji,foto_url,rol,user_id,gestionado_por,ocasion_id,creado_en').eq('familia_id', fam).order('creado_en'),
    sb.from('ocasiones').select('id,nombre,icono,mes,dia,orden').eq('familia_id', fam).order('orden'),
    sb.from('regalos').select('id,para_perfil_id,elfo_perfil_id,nombre,tienda,talla,enlace,observaciones,ocasion_id,estado,escondite,favorito,precio,pagado_por_perfil_id,reembolsado,fuera_de_lista,creado_en')
      .eq('familia_id', fam).eq('temporada', temporada()).eq('retirado', false).order('creado_en'),
    sb.from('familias').select('codigo_invitacion').eq('id', fam).maybeSingle()
  ]);
  const err = p.error || o.error || r.error;
  if (err) throw err;
  st.fam = { perfiles: p.data || [], ocasiones: o.data || [], regalos: r.data || [], codigo: f.data ? f.data.codigo_invitacion : '' };
}
const persona = (id) => (st.fam && st.fam.perfiles.find((x) => x.id === id)) || null;
const esFamiliar = (p) => p && p.rol === 'familiar';
const elfosFamilia = () => {
  const lista = st.fam.perfiles.filter((p) => p.rol === 'elfo' || p.rol === 'jefe');
  return lista.sort((a, b) => (a.id === st.perfil.id ? -1 : b.id === st.perfil.id ? 1 : 0));
};
const nombreDe = (id) => (id === st.perfil.id ? 'Tú' : (persona(id) || {}).nombre || '—');
function fechaOcasion(o) {
  if (!o || !o.mes || !o.dia) return null;
  const ahora = hoy();
  const base = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  let d = new Date(ahora.getFullYear(), o.mes - 1, o.dia);
  // Temporada: de julio a junio. Una fecha de enero-junio cae en el año siguiente si estamos en jul-dic.
  if (ahora.getMonth() >= 6 && o.mes - 1 < 6) d = new Date(ahora.getFullYear() + 1, o.mes - 1, o.dia);
  if (ahora.getMonth() < 6 && o.mes - 1 >= 6) d = new Date(ahora.getFullYear() - 1, o.mes - 1, o.dia);
  return { fecha: d, dias: Math.round((d - base) / 86400000) };
}
function cuandoOcasion(o) {
  const f = fechaOcasion(o);
  if (!f) return 'Sin fecha fija';
  const t = `${f.fecha.getDate()} ${MESES[f.fecha.getMonth()]}`;
  return `${t} · ${f.dias < 0 ? 'ya pasó' : f.dias === 0 ? '¡es hoy!' : f.dias === 1 ? 'falta 1 día' : `faltan ${f.dias} días`}`;
}
function estadoVisible(r) {
  const f = fechaOcasion(st.fam.ocasiones.find((o) => o.id === r.ocasion_id));
  if ((r.estado === 'en_casa' || r.estado === 'envuelto') && f && f.dias < 0) return 'entregado';
  return r.estado;
}
const chip = (k, extra = '') => `<span class="chip" style="background:${k[2]};color:${k[1]};${extra}"><span class="chip-punto" aria-hidden="true" style="background:${k[1]}"></span>${k[0]}</span>`;
const enlacesDe = (r) => String(r.enlace || '').split(/[\s,]+/).map((x) => x.trim()).filter((x) => /^https?:\/\//i.test(x));
function filaEnlaces(r) {
  const ls = enlacesDe(r);
  if (!ls.length) return '';
  return `<div class="fila-enlaces">${ls.map((u, i) => `<a class="maquina enlace" href="${esc(u)}" target="_blank" rel="noopener">${ls.length === 1 ? 'Ver enlace' : `Enlace ${i + 1}`}${ENLACE_ICONO}</a>`).join('')}</div>`;
}
const fotoOEmoji = (p) => (p && p.foto_url ? `<img src="${esc(p.foto_url)}" alt="">` : `<span aria-hidden="true">${esc((p && p.emoji) || '🎁')}</span>`);
const euros = (v) => `${(Number(v) || 0).toFixed(2).replace('.', ',')} €`;
const digitosDe = (v) => String(Math.round(Math.max(0, v))).padStart(2, '0').split('');

function menuTareas() {
  return menu('tareas');
}

// ---------- Mis tareas ----------
function colaAdoptar() {
  const huerfanos = st.fam.regalos.filter((r) => !r.elfo_perfil_id);
  const s = st.tareas.saltados;
  return huerfanos.sort((a, b) => s.indexOf(a.id) - s.indexOf(b.id) || (b.favorito - a.favorito));
}
function colaSinOcasion() {
  const s = st.tareas.saltados;
  return st.fam.regalos.filter((r) => r.elfo_perfil_id && !r.ocasion_id).sort((a, b) => s.indexOf(a.id) - s.indexOf(b.id));
}
function hojaRegalo(r, pequena) {
  const p = persona(r.para_perfil_id) || {};
  const conFoto = !esFamiliar(p);
  const elfo = r.elfo_perfil_id ? `<div class="celda"><span class="maquina">Elfo:</span><span class="mano m22">${esc(nombreDe(r.elfo_perfil_id))}</span></div>` : '';
  return `
  <div class="hoja-regalo${pequena ? ' pequena' : ''}">
    <div class="cabecera-regalo${conFoto ? '' : ' ancha'}">
      <div class="maquina" style="font-size:12px;letter-spacing:2.5px">Regalo para</div>
      <div style="display:flex;align-items:baseline;gap:8px;margin-top:4px">
        <div class="grano titulo" style="font-size:25px;line-height:1.15">${esc(p.nombre || '')}</div>
        ${conFoto ? '' : `<span style="font-size:22px;line-height:1">${esc(p.emoji || '')}</span>`}
      </div>
      <div style="margin-top:10px;border-top:1.5px solid rgba(158,42,43,.55)"></div>
    </div>
    <div class="tabla-regalo" style="top:${conFoto ? 176 : 118}px">
      <div class="celda"><span class="maquina">Regalo:</span><span class="mano m27">${esc(r.nombre)}</span></div>
      <div class="dos-col"><div class="celda"><span class="maquina">Tienda:</span><span class="mano m22">${esc(r.tienda || '—')}</span></div>
        <div class="celda"><span class="maquina">Talla:</span><span class="mano m22">${esc(r.talla || '—')}</span></div></div>
      ${elfo}
      ${r.observaciones ? `<div class="celda"><span class="maquina">Notas:</span><span class="mano m21">${esc(r.observaciones)}</span></div>` : ''}
      ${filaEnlaces(r)}
    </div>
    ${conFoto ? `<div class="polaroid-regalo"><div class="foto">${fotoOEmoji(p)}</div></div>` : ''}
    <div class="sello-arrastre sello-si" aria-hidden="true">${pequena ? '¡ASIGNADO!' : '¡ADOPTADO!'}</div>
    <div class="sello-arrastre sello-no" aria-hidden="true">OTRO DÍA</div>
  </div>`;
}
function vacioTarjeta(titulo, texto, boton, accion, valor) {
  return `<div class="hoja-lisa sombra-azul vacio-tarjeta">
    <div class="grano titulo" style="font-size:22px;line-height:1.25">${titulo}</div>
    <p class="mano" style="margin:0;font-size:23px;line-height:1.1">${texto}</p>
    ${boton ? `<button type="button" class="boton boton-peq" data-accion="${accion}" data-valor="${valor || ''}">${boton}</button>` : ''}
  </div>`;
}
function pestanasPapel(lista, activa, accion) {
  return `<div role="tablist" class="papel tira-pestanas${lista.length > 3 ? ' cuatro' : ''}">
    ${lista.map(([id, nombre]) => `<button type="button" role="tab" class="pildora" aria-selected="${id === activa}" data-accion="${accion}" data-valor="${id}">${id === activa ? CIRCULO_ROJO : ''}${nombre}</button>`).join('')}
  </div>`;
}

function pTareas() {
  if (!st.fam) return `<main class="pantalla fondo-tareas"><div class="cargando">Abriendo tus tareas…</div>${menu('tareas')}</main>`;
  const t = st.tareas;
  const jefe = st.perfil.rol === 'jefe';
  if (t.pestana === 'revisar' && !jefe) t.pestana = 'adoptar';
  const tabs = [['adoptar', 'Adoptar'], ['pendientes', 'Pendientes'], ['listos', 'Listos']].concat(jefe ? [['revisar', 'Revisar']] : []);
  let cuerpo = '';
  if (t.pestana === 'adoptar' || t.pestana === 'revisar') cuerpo = cuerpoTarjetas();
  else cuerpo = cuerpoLista();
  return `
  <main class="pantalla fondo-tareas">
    <div class="columna">
      <img src="img/cartel-tareas.png" alt="Tus tareas" class="cartel" width="220" height="91">
      ${pestanasPapel(tabs, t.pestana, 'pestanaTareas')}
      ${cuerpo}
    </div>
    ${menu('tareas')}
    ${st.error && !t.ficha && !t.nuevo ? `<p class="toast" role="alert">${esc(st.error)}</p>` : ''}
    ${t.ficha ? fichaTarea() : ''}
    ${t.nuevo ? fichaNuevoRegalo() : ''}
  </main>`;
}

function cuerpoTarjetas() {
  const t = st.tareas;
  const revisar = t.pestana === 'revisar';
  const cola = revisar && t.sub === 'ocasion' ? colaSinOcasion() : colaAdoptar();
  const r = cola[0];
  let cabeza = '';
  if (revisar) {
    const n1 = colaAdoptar().length, n2 = colaSinOcasion().length;
    cabeza = `<div class="sub-interruptor" role="group" aria-label="Qué revisar">
      ${[['elfo', 'Sin elfo', n1], ['ocasion', 'Sin ocasión', n2]].map(([id, nom, n]) => `<button type="button" aria-pressed="${t.sub === id}" data-accion="subRevisar" data-valor="${id}">${nom}<span class="globo">${n}</span></button>`).join('')}
    </div>`;
  } else {
    cabeza = `<div class="linea-contador">
      <p class="maquina claro-rojo">${cola.length === 1 ? 'Queda 1 regalo sin elfo' : `Quedan ${cola.length} regalos sin elfo`}</p>
      <button type="button" class="boton-sec boton-mini" data-accion="nuevoRegaloSorpresa">${MAS} Apuntar regalo</button>
    </div>`;
  }
  if (!r) {
    let titulo, texto, boton = '', accion = '';
    if (revisar) {
      const quedan = colaAdoptar().length + colaSinOcasion().length;
      titulo = quedan ? (t.sub === 'elfo' ? 'Todos tienen elfo' : 'Todos tienen ocasión') : '¡Taller en orden!';
      texto = quedan ? (t.sub === 'elfo' ? 'Te quedan regalos sin ocasión por revisar.' : 'Te quedan regalos sin elfo por revisar.') : 'Cada regalo tiene su elfo y su fecha. Los Reyes pueden dormir tranquilos.';
      if (quedan) { boton = t.sub === 'elfo' ? 'Ver sin ocasión' : 'Ver sin elfo'; accion = 'subRevisar'; }
    } else {
      titulo = '¡Ni un regalo huérfano!'; texto = 'Todos los deseos ya tienen elfo. ¡Este taller es una máquina!'; boton = 'Ver mis pendientes'; accion = 'pestanaTareas';
    }
    return `${cabeza}<div class="centro-vacio">${vacioTarjeta(titulo, texto, boton, accion, boton === 'Ver mis pendientes' ? 'pendientes' : (t.sub === 'elfo' ? 'ocasion' : 'elfo'))}</div>`;
  }
  const pequena = revisar;
  const siguiente = cola[1] ? '<div class="hoja-lisa sombra-roja detras-tarjeta" aria-hidden="true"></div>' : '';
  const controles = revisar
    ? (t.sub === 'elfo'
      ? `<div class="controles-revisar">
          <div class="fila-control"><span class="maquina claro-rojo">Asignar a:</span><button type="button" class="enlace-claro maquina" data-accion="saltarTarjeta">Saltar</button></div>
          <div class="fila-elfos" role="group" aria-label="Elegir elfo">
            ${elfosFamilia().map((e) => `<button type="button" class="elfo-boton" data-accion="asignarElfo" data-valor="${e.id}" aria-label="Asignar a ${e.id === st.perfil.id ? 'ti' : esc(e.nombre)}">
              <span class="papel circulo-elfo" aria-hidden="true">${fotoOEmoji(e)}</span><span class="nombre-elfo">${esc(nombreDe(e.id))}</span></button>`).join('')}
          </div></div>`
      : `<div class="controles-revisar">
          <div class="fila-control"><span class="maquina claro-rojo">¿Para qué ocasión?</span><button type="button" class="enlace-claro maquina" data-accion="saltarTarjeta">Saltar</button></div>
          <div class="fila-ocasiones" role="group" aria-label="Elegir ocasión">
            ${st.fam.ocasiones.map((o) => { const f = fechaOcasion(o); return `<button type="button" class="opcion opcion-crema" data-accion="asignarOcasion" data-valor="${o.id}">${esc(o.icono || '')} ${esc(o.nombre)}<span class="opcion-fecha">${f ? `${f.fecha.getDate()} ${MESES[f.fecha.getMonth()]}` : ''}</span></button>`; }).join('')}
          </div></div>`)
    : `<div class="botones-adoptar">
        <div class="boton-con-texto"><button type="button" class="redondo papel" aria-label="Saltar este regalo" data-accion="saltarTarjeta">${CERRAR}</button><span class="maquina claro-rojo">Saltar</span></div>
        <div class="boton-con-texto"><button type="button" class="redondo verde" aria-label="Adoptar este regalo" data-accion="adoptarTarjeta"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="9" width="17" height="11.5" rx="1"></rect><path d="M2.5 9h19v-3.2h-19zM12 5.8v14.7M12 5.8c-1.6-3.3-5.8-3.3-5.2-.6.4 1.3 3 .6 5.2.6zM12 5.8c1.6-3.3 5.8-3.3 5.2-.6-.4 1.3-3 .6-5.2.6z"></path></svg></button><span class="maquina claro-rojo" style="font-weight:700">Adoptar</span></div>
      </div>`;
  return `${cabeza}
    <div class="zona-tarjeta${pequena ? ' pequena' : ''}">
      <div class="escala-tarjeta">
        ${siguiente}
        <article class="tarjeta-arrastre${t.saliendo ? ' sale-' + t.saliendo : ''}" data-swipe="${revisar ? '' : '1'}" data-regalo="${r.id}" aria-label="Regalo para ${esc((persona(r.para_perfil_id) || {}).nombre || '')}: ${esc(r.nombre)}">
          ${hojaRegalo(r, pequena)}
        </article>
      </div>
    </div>
    ${controles}`;
}

function misRegalos() { return st.fam.regalos.filter((r) => r.elfo_perfil_id === st.perfil.id); }
function cuerpoLista() {
  const t = st.tareas;
  const pend = t.pestana === 'pendientes';
  const mios = misRegalos();
  const enTab = mios.filter((r) => { const e = estadoVisible(r); return pend ? (e === 'pendiente' || e === 'pedido') : (e === 'en_casa' || e === 'envuelto' || e === 'entregado'); });
  const cuenta = (k) => mios.filter((r) => estadoVisible(r) === k).length;
  const marcadores = pend ? [['Sin empezar', cuenta('pendiente')], ['Pedidos', cuenta('pedido')]] : [['Conseguidos', cuenta('en_casa')], ['Envueltos', cuenta('envuelto')]];
  const grupos = st.fam.ocasiones.map((o) => ({ o, f: fechaOcasion(o), items: enTab.filter((r) => r.ocasion_id === o.id) }))
    .filter((g) => g.items.length)
    .sort((a, b) => { const pa = a.f && a.f.dias < 0, pb = b.f && b.f.dias < 0; if (pa !== pb) return pa ? 1 : -1; return (a.f ? a.f.dias : 999) - (b.f ? b.f.dias : 999); });
  const sinOc = enTab.filter((r) => !r.ocasion_id);
  if (sinOc.length) grupos.push({ o: { nombre: 'Sin ocasión', icono: '' }, f: null, items: sinOc, sin: true });
  const etiqueta = (r, i) => {
    const p = persona(r.para_perfil_id) || {};
    const e = estadoVisible(r);
    const faltaPrecio = !pend && !Number(r.precio);
    return `<div class="etiqueta-caja" style="transform:rotate(${i % 2 ? 0.8 : -0.8}deg);${e === 'entregado' ? 'opacity:.62' : ''}">
      <svg class="cordel" viewBox="0 0 40 30" aria-hidden="true"><path d="M38 15 C 28 13, 20 4, 10 8 C 2 11, 4 22, 0 26" fill="none" stroke="#c9a24a" stroke-width="1.6" stroke-linecap="round"></path></svg>
      <button type="button" class="tag papel-sin-sombra" data-accion="abrirTarea" data-valor="${r.id}" aria-label="${esc(r.nombre)}, para ${esc(p.nombre || '')}, ${EST[e][0].toLowerCase()}. Abrir ficha">
        <span class="agujero" aria-hidden="true"></span>
        <span class="maquina para-linea">Para ${esc(p.nombre || '')} <span style="letter-spacing:0">${esc(p.emoji || '')}</span></span>
        <span class="mano" style="font-size:25px;margin-top:2px;line-height:1.05">${esc(r.nombre)}</span>
        ${!pend && r.escondite && e !== 'entregado' ? `<span class="linea-escondite"><span class="maquina" style="font-size:10px">Escondido en:</span><span class="mano" style="font-size:19px">${esc(r.escondite)}</span></span>` : ''}
        ${faltaPrecio ? '<span class="aviso-etiqueta">⚠️ Falta apuntar el precio</span>' : ''}
        ${chip(EST[e], 'position:absolute;right:12px;top:11px')}
      </button></div>`;
  };
  return `
  <div class="scroll-lista">
    <div class="marcadores">
      ${marcadores.map(([tit, v]) => `<div class="tablero tablero-peq" role="group" aria-label="${tit}: ${v}"><div class="maquina">${tit}</div><div style="display:flex;gap:4px" aria-hidden="true">${digitosDe(v).map((d) => `<span class="ficha-digito">${d}</span>`).join('')}</div></div>`).join('')}
    </div>
    ${grupos.map((g) => `
      <section class="grupo">
        <h2 class="maquina cabecera-grupo"><span>${esc(g.o.nombre)}</span>${g.sin ? '' : `<span style="font-weight:400;opacity:.9">· ${g.f ? (g.f.dias < 0 ? 'ya pasó' : g.f.dias === 1 ? 'falta 1 día' : `faltan ${g.f.dias} días`) : 'sin fecha'}</span>`}<span class="raya" aria-hidden="true"></span></h2>
        ${g.items.map(etiqueta).join('')}
      </section>`).join('')}
    ${enTab.length ? '' : (pend
      ? vacioTarjeta('¡Todo en marcha!', 'No te queda nada por comprar. Ve a por un chocolate caliente, te lo has ganado.', 'Ir a adoptar', 'pestanaTareas', 'adoptar')
      : vacioTarjeta('Aún no hay nada listo', 'Cuando tengas un regalo en casa aparecerá aquí.'))}
  </div>`;
}

function fichaTarea() {
  const f = st.tareas.ficha;
  const r = st.fam.regalos.find((x) => x.id === f.id);
  if (!r) return '';
  const p = persona(r.para_perfil_id) || {};
  const o = st.fam.ocasiones.find((x) => x.id === r.ocasion_id);
  const verEscondite = ['en_casa', 'envuelto', 'entregado'].includes(f.estado);
  return `
  <div class="velo velo-tareas">
    <form class="ficha ficha-tarea" role="dialog" aria-modal="true" aria-labelledby="ft-t" data-form="tarea" novalidate>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
        <div>
          <div class="maquina" style="font-size:11px;letter-spacing:2px">Para ${esc(p.nombre || '')} <span style="letter-spacing:0">${esc(p.emoji || '')}</span> · ${o ? esc(o.nombre) : 'sin ocasión'}</div>
          <h2 id="ft-t" class="grano titulo" style="margin:4px 0 0;font-size:22px;line-height:1.2">${esc(r.nombre)}</h2>
          ${st.error ? `<p class="aviso" style="text-align:left;margin-top:4px">${esc(st.error)}</p>` : ''}
        </div>
        <button type="button" class="cerrar" aria-label="Cerrar" data-accion="cerrarTarea">${CERRAR}</button>
      </div>
      <div class="tabla">
        <div class="dos-col"><div class="celda"><span class="maquina">Tienda:</span><span class="mano m21">${esc(r.tienda || '—')}</span></div><div class="celda"><span class="maquina">Talla:</span><span class="mano m21">${esc(r.talla || '—')}</span></div></div>
        <div class="celda"><span class="maquina" id="est-etq">Estado:</span>
          <div role="radiogroup" aria-labelledby="est-etq" class="opciones">
            ${['pendiente', 'pedido', 'en_casa', 'envuelto'].map((k) => `<button type="button" role="radio" aria-checked="${f.estado === k}" class="opcion" data-accion="estadoTarea" data-valor="${k}" style="${f.estado === k ? `background:${EST[k][1]};color:#fff;border-color:${EST[k][1]}` : `color:${EST[k][1]}`}"><span class="chip-punto" style="background:${f.estado === k ? '#fff' : EST[k][1]}" aria-hidden="true"></span>${EST[k][0]}</button>`).join('')}
          </div>
          <span class="maquina nota-peq">“Entregado” se marca solo cuando pasa la fecha</span>
        </div>
        ${verEscondite ? `<div class="celda"><label for="t-esc" class="maquina">Escondido en:</label><input id="t-esc" class="campo-ficha" data-tarea="escondite" type="text" maxlength="80" value="${esc(f.escondite)}" placeholder="¿Dónde lo has guardado?"></div>` : ''}
        <div class="celda"><label for="t-precio" class="maquina">Precio:</label>
          <div style="display:flex;align-items:baseline;gap:4px;max-width:160px"><input id="t-precio" class="campo-ficha" data-tarea="precio" type="text" inputmode="decimal" value="${esc(f.precio)}" placeholder="0,00"><span class="mano" style="font-size:22px">€</span></div></div>
        <div class="celda" style="padding-right:0"><span class="maquina" id="pag-etq">Pagado por:</span>
          <div role="radiogroup" aria-labelledby="pag-etq" class="fila-pagadores">
            ${elfosFamilia().map((e) => `<button type="button" role="radio" aria-checked="${f.pagado === e.id}" class="pagador" data-accion="pagadoTarea" data-valor="${e.id}"><span class="circulo-pagador${f.pagado === e.id ? ' activo' : ''}" aria-hidden="true">${fotoOEmoji(e)}</span><span class="nombre-pagador">${esc(nombreDe(e.id))}</span></button>`).join('')}
          </div></div>
        ${r.observaciones ? `<div class="celda"><span class="maquina">Notas:</span><span class="mano m20">${esc(r.observaciones)}</span></div>` : ''}
        ${filaEnlaces(r)}
      </div>
      <button type="submit" class="boton boton-peq" style="align-self:center" ${st.ocupado ? 'disabled' : ''}>${st.ocupado ? 'Guardando…' : 'Guardar'}</button>
    </form>
  </div>`;
}

function fichaNuevoRegalo() {
  const f = st.tareas.nuevo;
  const gente = st.fam.perfiles.filter((p) => p.id !== st.perfil.id && p.user_id !== st.uid);
  return `
  <div class="velo velo-tareas">
    <form class="ficha" role="dialog" aria-modal="true" aria-labelledby="nr-t" data-form="nuevoRegalo" novalidate>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <h2 id="nr-t" class="grano titulo" style="margin:0;font-size:22px">Apuntar un regalo</h2>
        <button type="button" class="cerrar" aria-label="Cerrar" data-accion="cerrarNuevo">${CERRAR}</button>
      </div>
      <p style="margin:-6px 0 0;font-size:13px;line-height:1.4;color:#5e4f48">Para regalos sorpresa o para familiares sin app. Queda adoptado por ti y no sale en ninguna carta.</p>
      <div style="display:flex;flex-direction:column;gap:6px"><span class="etiqueta" id="para-etq">¿Para quién? <span style="color:#9e2a2b">*</span></span>
        <div role="radiogroup" aria-labelledby="para-etq" class="opciones">
          ${gente.map((p) => `<button type="button" role="radio" aria-checked="${f.para === p.id}" class="opcion" data-accion="paraNuevo" data-valor="${p.id}" style="${f.para === p.id ? 'background:#24402f;color:#fff;border-color:#24402f' : ''}">${esc(p.emoji || '')} ${esc(p.nombre)}</button>`).join('')}
        </div></div>
      ${['nombre|¿Qué regalo? *|Ej.: Bufanda de lana', 'tienda|Tienda|¿Dónde?', 'talla|Talla|M, 42…', 'enlace|Enlace|https://…', 'observaciones|Más pistas|Color, modelo…'].map((x) => { const [k, l, ph] = x.split('|'); return `<div style="display:flex;flex-direction:column;gap:2px"><label for="nr-${k}" class="etiqueta">${l.replace('*', '<span style="color:#9e2a2b">*</span>')}</label><input id="nr-${k}" class="campo" data-nuevo="${k}" type="text" value="${esc(f[k])}" placeholder="${ph}"></div>`; }).join('')}
      <button type="submit" class="boton boton-peq" id="btn-nuevo" style="align-self:center" ${f.para && f.nombre.trim() && !st.ocupado ? '' : 'disabled'}>Guardar regalo</button>
    </form>
  </div>`;
}

// ---------- Mi Casa ----------
function pCasa() {
  if (!st.fam) return `<main class="pantalla fondo-casa"><div class="cargando">Abriendo la casa…</div>${menu('casa')}</main>`;
  const c = st.casa;
  let cuerpo = '';
  if (c.pestana === 'familia') cuerpo = c.persona ? casaPersona() : casaFamilia();
  else if (c.pestana === 'ocasiones') cuerpo = c.ocasion ? casaOcasion() : casaOcasiones();
  else cuerpo = casaPresupuesto();
  return `
  <main class="pantalla fondo-casa">
    <div class="columna">
      <img src="img/cartel-casa.png" alt="Mi Casa" class="cartel" width="220" height="91">
      ${pestanasPapel([['familia', 'Mi familia'], ['ocasiones', 'Ocasiones'], ['presupuesto', 'Presupuesto']], c.pestana, 'pestanaCasa')}
      <div class="scroll-lista scroll-casa">${cuerpo}</div>
    </div>
    ${menu('casa')}
    ${st.error && !c.hoja ? `<p class="toast" role="alert">${esc(st.error)}</p>` : ''}
    ${c.hoja ? hojaCasa() : ''}
  </main>`;
}
const giros = ['-2.5deg', '1.5deg', '-1deg', '2.5deg', '-1.8deg', '1deg'];
const regalosPara = (id) => st.fam.regalos.filter((r) => r.para_perfil_id === id);
function casaFamilia() {
  const miembros = st.fam.perfiles.filter((p) => !esFamiliar(p));
  const familiares = st.fam.perfiles.filter(esFamiliar);
  const url = `${location.origin}${location.pathname}?f=${st.fam.codigo}`;
  return `
    <div class="rejilla-polaroids">
      ${miembros.map((p, i) => { const yo = p.id === st.perfil.id; const k = ROL[p.rol] || ROL.nino; return `
        <button type="button" class="miembro" data-accion="abrirPersona" data-valor="${p.id}" aria-label="${esc(p.nombre)}, ${k[0]}. Ver sus regalos">
          <div class="polaroid" style="--giro:${giros[i % giros.length]}"><div class="foto">${fotoOEmoji(p)}</div><div class="pie">${esc(p.nombre)}</div></div>
          <div class="bajo-polaroid">${chip(k)}<span class="claro-azul" style="font-size:12px;font-weight:600">🎁 ${yo ? '🤫' : regalosPara(p.id).length}</span></div>
        </button>`; }).join('')}
    </div>
    <section class="grupo">
      <h2 class="maquina cabecera-grupo claro-azul"><span>Familiares</span><span class="raya" aria-hidden="true"></span></h2>
      <p class="claro-azul" style="margin:-4px 0 2px;font-size:12.5px">No usan la app. Los elfos les apuntan los regalos.</p>
      ${familiares.map((p) => { const o = st.fam.ocasiones.find((x) => x.id === p.ocasion_id); return `
        <button type="button" class="fila-papel papel" data-accion="abrirPersona" data-valor="${p.id}">
          <span class="circulo-blanco" aria-hidden="true">${esc(p.emoji || '🎁')}</span>
          <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span class="mano" style="font-size:23px">${esc(p.nombre)}</span><span class="maquina" style="font-size:10px">${o ? esc(`${o.icono || ''} ${o.nombre}`) : 'Sin ocasión'}</span></span>
          <span style="font-size:12.5px;font-weight:600;color:#3a3330">🎁 ${regalosPara(p.id).length}</span>
        </button>`; }).join('')}
      ${familiares.length ? '' : '<p class="claro-azul" style="margin:0;font-size:13px;opacity:.85">Todavía no hay familiares.</p>'}
    </section>
    <button type="button" class="boton boton-peq centrado" data-accion="nuevoMiembro">${MAS} Añadir niño o familiar</button>
    <div class="hoja-lisa sombra-azul invitacion">
      <span class="maquina" style="font-size:11px;letter-spacing:2px">Enlace de invitación</span>
      <p style="margin:0;font-size:13px;line-height:1.4;color:#4a3d36">Quien entre con este enlace se une a <b>${esc(st.perfil.familias?.nombre || '')}</b> como niño. Luego le cambias el rol aquí.</p>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:2px;flex-wrap:wrap">
        <span style="font-family:'Courier Prime',monospace;font-weight:700;font-size:20px;letter-spacing:3px;color:#9e2a2b">${esc(st.fam.codigo)}</span>
        <div style="display:flex;gap:6px">
          <button type="button" class="boton-sec borde" data-accion="copiarEnlace" data-valor="${esc(url)}">${st.casa.copiado ? '¡Copiado!' : 'Copiar'}</button>
          <button type="button" class="boton-sec verde" data-accion="compartirEnlace" data-valor="${esc(url)}">Compartir</button>
        </div>
      </div>
    </div>`;
}
function etiquetasRegalos(lista) {
  return lista.map((r) => { const e = estadoVisible(r); return `
    <div class="etiqueta-caja azul"><div class="tag papel-sin-sombra estatica">
      <span class="agujero" aria-hidden="true"></span>
      <span class="mano" style="font-size:23px;padding-right:104px;line-height:1.05">${esc(r.nombre)}</span>
      <span class="maquina" style="font-size:10px;margin-top:2px">${r.elfo_perfil_id ? `Elfo: ${esc(nombreDe(r.elfo_perfil_id))}` : 'Sin elfo'}</span>
      ${chip(EST[e], 'position:absolute;right:12px;top:10px')}
    </div></div>`; }).join('');
}
function casaPersona() {
  const p = persona(st.casa.persona);
  if (!p) { st.casa.persona = null; return casaFamilia(); }
  const yo = p.id === st.perfil.id;
  const fam = esFamiliar(p);
  const k = ROL[p.rol] || ROL.nino;
  const o = fam ? st.fam.ocasiones.find((x) => x.id === p.ocasion_id) : null;
  const gestor = p.gestionado_por ? persona(p.gestionado_por) : null;
  const detalle = fam ? `Solo en ${o ? `${o.icono || ''} ${o.nombre}` : '—'} · sin app` : yo ? 'Eres tú' : gestor ? `Su carta la escribe ${gestor.id === st.perfil.id ? 'contigo' : gestor.nombre}` : p.user_id ? 'Tiene su propia cuenta' : 'Sin cuenta todavía';
  const rs = regalosPara(p.id);
  const grupos = st.fam.ocasiones.map((oc) => ({ oc, items: rs.filter((r) => r.ocasion_id === oc.id) })).filter((g) => g.items.length);
  const sinOc = rs.filter((r) => !r.ocasion_id);
  return `
    <button type="button" class="volver claro-azul" data-accion="cerrarPersona">${FLECHA_ATRAS} Mi familia</button>
    <div style="display:flex;align-items:center;gap:18px">
      ${fam ? `<span class="circulo-blanco grande" aria-hidden="true">${esc(p.emoji || '🎁')}</span>` : `<div class="polaroid grande" style="--giro:-3deg"><div class="foto">${fotoOEmoji(p)}</div><div class="pie"></div></div>`}
      <div style="display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-width:0">
        <span class="claro-azul" style="font-family:Caveat,cursive;font-size:36px;line-height:1">${esc(p.nombre)}</span>
        ${chip(k)}
        <span class="claro-azul" style="font-size:12.5px;line-height:1.35">${esc(detalle)}</span>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:2px">
          <button type="button" class="boton-sec borde" data-accion="editarPersona" data-valor="${p.id}">✏️ Editar</button>
          ${yo ? '' : `<button type="button" class="boton-sec verde" data-accion="regaloParaPersona" data-valor="${p.id}">${MAS} Regalo</button>`}
        </div>
      </div>
    </div>
    ${yo ? '<div class="nota-clara">🤫 Tus regalos son sorpresa: aquí no puedes verlos.</div>' : ''}
    ${grupos.map((g) => `<section class="grupo"><h3 class="maquina cabecera-grupo claro-azul">${esc(`${g.oc.icono || ''} ${g.oc.nombre}`)} <span style="font-weight:400;opacity:.9">· ${reg(g.items.length)}</span><span class="raya" aria-hidden="true"></span></h3>${etiquetasRegalos(g.items)}</section>`).join('')}
    ${sinOc.length ? `<section class="grupo"><h3 class="maquina cabecera-grupo claro-azul">Sin ocasión <span style="font-weight:400;opacity:.9">· ${reg(sinOc.length)}</span><span class="raya" aria-hidden="true"></span></h3>${etiquetasRegalos(sinOc)}</section>` : ''}
    ${!yo && !rs.length ? '<div class="nota-clara aviso">⚠️ Todavía no tiene ningún regalo.</div>' : ''}`;
}
function participantes(o) {
  return st.fam.perfiles.filter((p) => !esFamiliar(p) || p.ocasion_id === o.id);
}
function casaOcasiones() {
  return `
    ${st.fam.ocasiones.map((o) => {
      const gente = participantes(o).filter((p) => p.id !== st.perfil.id);
      const sinNada = gente.filter((p) => !st.fam.regalos.some((r) => r.para_perfil_id === p.id && r.ocasion_id === o.id)).length;
      const n = st.fam.regalos.filter((r) => r.ocasion_id === o.id).length;
      return `<button type="button" class="fila-papel papel tarjeta-ocasion" data-accion="abrirOcasion" data-valor="${o.id}">
        <span aria-hidden="true" style="font-size:30px;line-height:1;width:40px;text-align:center;flex-shrink:0">${esc(o.icono || '🎉')}</span>
        <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
          <span class="grano titulo" style="font-size:18px;line-height:1.2">${esc(o.nombre)}</span>
          <span class="maquina" style="font-size:10.5px">${cuandoOcasion(o)}</span>
          <span style="display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:3px;font-size:12.5px;color:#3a3330"><span>🎁 ${reg(n)}</span>${sinNada ? `<span style="font-weight:600;color:#8e1f20">⚠️ ${sinNada === 1 ? '1 persona sin regalo' : `${sinNada} personas sin regalo`}</span>` : ''}</span>
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5e4f48" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>
      </button>`; }).join('')}
    <button type="button" class="boton boton-peq centrado" data-accion="nuevaOcasion">${MAS} Nueva ocasión</button>`;
}
function casaOcasion() {
  const o = st.fam.ocasiones.find((x) => x.id === st.casa.ocasion);
  if (!o) { st.casa.ocasion = null; return casaOcasiones(); }
  const gente = participantes(o).map((p) => ({ p, rs: st.fam.regalos.filter((r) => r.para_perfil_id === p.id && r.ocasion_id === o.id) }))
    .sort((a, b) => { const ya = a.p.id === st.perfil.id, yb = b.p.id === st.perfil.id; if (ya !== yb) return ya ? 1 : -1; return (a.rs.length ? 1 : 0) - (b.rs.length ? 1 : 0); });
  return `
    <div style="display:flex;align-items:center;gap:8px">
      <button type="button" class="volver claro-azul solo-icono" data-accion="cerrarOcasion" aria-label="Volver a ocasiones">${FLECHA_ATRAS}</button>
      <span aria-hidden="true" style="font-size:26px">${esc(o.icono || '🎉')}</span>
      <span style="display:flex;flex-direction:column"><span class="claro-azul titulo" style="font-size:20px">${esc(o.nombre)}</span><span class="maquina claro-azul" style="font-size:10.5px">${cuandoOcasion(o)}</span></span>
      <button type="button" class="boton-sec borde" style="margin-left:auto;min-height:36px" data-accion="editarOcasion" data-valor="${o.id}">✏️</button>
    </div>
    ${gente.map(({ p, rs }) => { const yo = p.id === st.perfil.id; return `
      <section class="grupo">
        <h3 class="maquina cabecera-grupo claro-azul" style="font-size:11.5px"><span style="letter-spacing:0;font-size:16px">${esc(p.emoji || '')}</span>${esc(p.nombre)}<span style="font-weight:400;opacity:.9">· ${yo ? 'sorpresa 🤫' : reg(rs.length)}</span><span class="raya" aria-hidden="true"></span></h3>
        ${!yo && !rs.length ? '<div class="nota-clara aviso">⚠️ No tiene ningún regalo para esta ocasión</div>' : ''}
        ${etiquetasRegalos(rs)}
      </section>`; }).join('')}`;
}
function casaPresupuesto() {
  const rs = st.fam.regalos;
  const total = rs.reduce((a, r) => a + (Number(r.precio) || 0), 0);
  const deudas = {};
  rs.forEach((r) => {
    const pag = persona(r.pagado_por_perfil_id);
    if (!pag || pag.rol === 'jefe' || r.reembolsado || !Number(r.precio)) return;
    deudas[pag.id] = deudas[pag.id] || { p: pag, t: 0, n: 0 };
    deudas[pag.id].t += Number(r.precio); deudas[pag.id].n += 1;
  });
  const listaDeudas = Object.values(deudas).sort((a, b) => b.t - a.t);
  const pendiente = listaDeudas.reduce((a, d) => a + d.t, 0);
  const porPersona = st.fam.perfiles.map((p) => { const x = regalosPara(p.id); return { p, n: x.length, t: x.reduce((a, r) => a + (Number(r.precio) || 0), 0) }; })
    .filter((x) => x.t > 0).sort((a, b) => b.t - a.t);
  const maxT = Math.max(1, ...porPersona.map((x) => x.t));
  return `
    <div class="marcadores">
      ${[['Gastado', total], ['Por devolver', pendiente]].map(([tit, v]) => `<div class="tablero tablero-peq" role="group" aria-label="${tit}: ${euros(v)}"><div class="maquina">${tit}</div><div style="display:flex;align-items:center;gap:3px" aria-hidden="true">${digitosDe(v).map((d) => `<span class="ficha-digito">${d}</span>`).join('')}<span class="euro">€</span></div></div>`).join('')}
    </div>
    <section class="grupo">
      <h2 class="maquina cabecera-grupo claro-azul"><span>Por devolver</span><span class="raya" aria-hidden="true"></span></h2>
      ${listaDeudas.map((d) => `<div class="fila-papel papel estatica">
        <span class="circulo-blanco" aria-hidden="true">${fotoOEmoji(d.p)}</span>
        <span style="flex:1;min-width:0;display:flex;flex-direction:column"><span class="mano" style="font-size:23px">${esc(d.p.nombre)}</span><span class="maquina" style="font-size:10px">Pagó ${reg(d.n)}</span></span>
        <span class="titulo" style="font-size:16px;color:#9e2a2b">${euros(d.t)}</span>
        <button type="button" class="boton-sec borde" style="min-height:38px;padding:0 12px" data-accion="saldar" data-valor="${d.p.id}">Devuelto</button>
      </div>`).join('')}
      ${listaDeudas.length ? '' : '<div class="nota-clara verde">✨ Cuentas al día: no le debéis nada a ningún elfo.</div>'}
    </section>
    <section class="grupo">
      <h2 class="maquina cabecera-grupo claro-azul"><span>Gastado por persona</span><span class="raya" aria-hidden="true"></span></h2>
      <div class="hoja-lisa sombra-azul gastos">
        ${porPersona.map((x) => `<div style="display:flex;flex-direction:column;gap:5px">
          <div style="display:flex;align-items:baseline;gap:8px"><span aria-hidden="true" style="font-size:17px">${esc(x.p.emoji || '')}</span><span class="mano" style="font-size:22px;flex:1">${esc(x.p.nombre)}</span><span style="font-size:12px;color:#5e4f48">${reg(x.n)}</span><span style="font-size:14px;font-weight:700;color:#2b2320;min-width:62px;text-align:right">${euros(x.t)}</span></div>
          <div class="barra" aria-hidden="true"><div style="width:${Math.max(4, Math.round(x.t / maxT * 100))}%"></div></div>
        </div>`).join('')}
        ${porPersona.length ? '' : '<p class="mano" style="margin:0;font-size:21px">Todavía nadie ha apuntado ningún precio.</p>'}
      </div>
    </section>`;
}
function hojaCasa() {
  const h = st.casa.hoja;
  const opc = (on, color) => (on ? `background:${color};color:#fff;border-color:${color}` : '');
  const adultos = st.fam.perfiles.filter((p) => p.rol === 'elfo' || p.rol === 'jefe');
  let titulo = '', cuerpo = '', boton = 'Guardar';
  if (h.tipo === 'persona') {
    const yo = h.id === st.perfil.id;
    titulo = h.id ? 'Editar' : 'Nuevo miembro';
    boton = h.id ? 'Guardar' : 'Añadir';
    const roles = h.id ? (h.rol === 'familiar' ? ['familiar'] : (persona(h.id)?.user_id ? ['nino', 'elfo', 'jefe'] : ['nino'])) : ['nino', 'familiar'];
    cuerpo = `
      <div class="dos-col" style="grid-template-columns:minmax(0,3fr) minmax(0,1fr)">
        <div class="celda"><label for="h-nombre" class="maquina">Nombre:</label><input id="h-nombre" class="campo-ficha" data-hoja="nombre" type="text" maxlength="60" value="${esc(h.nombre)}" placeholder="¿Cómo se llama?"></div>
        <div class="celda"><label for="h-emoji" class="maquina">Emoji:</label><input id="h-emoji" class="campo-ficha emoji-campo" data-hoja="emoji" type="text" value="${esc(h.emoji)}" placeholder="+"></div>
      </div>
      ${h.rol !== 'familiar' ? `<div class="celda"><span class="maquina">Foto:</span>
        <div style="display:flex;align-items:center;gap:12px;padding-top:4px">
          <span class="circulo-blanco foto-mini" aria-hidden="true">${h.fotoUrl ? `<img src="${esc(h.fotoUrl)}" alt="">` : esc(h.emoji || '📷')}</span>
          <label class="boton-sec borde" style="position:relative;overflow:hidden">${h.fotoUrl ? 'Cambiar foto' : 'Subir foto'}<input type="file" accept="image/*" data-hoja-foto="1" class="subir"></label>
        </div>
        <span class="nota-peq">Si hay foto, sale en la Polaroid en lugar del emoji.</span></div>` : ''}
      ${roles.length > 1 ? `<div class="celda"><span class="maquina" id="rol-etq">${h.id ? 'Rol:' : 'Es…'}</span>
        <div role="radiogroup" aria-labelledby="rol-etq" class="opciones">${roles.map((r) => `<button type="button" role="radio" aria-checked="${h.rol === r}" class="opcion" data-accion="hojaRol" data-valor="${r}" style="${h.rol === r ? opc(true, ROL[r][1]) : `color:${ROL[r][1]}`}"><span class="chip-punto" aria-hidden="true" style="background:${h.rol === r ? '#fff' : ROL[r][1]}"></span>${r === 'familiar' ? 'Familiar (sin app)' : ROL[r][0]}</button>`).join('')}</div>
        ${yo && h.rol !== 'jefe' ? '<span class="nota-peq" style="color:#8e1f20">Si dejas de ser jefe no podrás volver a entrar en Mi Casa.</span>' : ''}</div>` : ''}
      ${h.rol === 'nino' && !(h.id && persona(h.id)?.user_id) ? `<div class="celda"><span class="maquina" id="ges-etq">Le ayuda con su carta:</span>
        <div role="radiogroup" aria-labelledby="ges-etq" class="opciones">${adultos.map((a) => `<button type="button" role="radio" aria-checked="${h.gestor === a.id}" class="opcion" data-accion="hojaGestor" data-valor="${a.id}" style="${opc(h.gestor === a.id, '#24402f')}">${esc(a.emoji || '')} ${esc(nombreDe(a.id))}</button>`).join('')}</div>
        <span class="nota-peq">Su carta aparecerá en el móvil de esa persona, para escribirla juntos.</span></div>` : ''}
      ${h.rol === 'familiar' ? `<div class="celda"><span class="maquina" id="oc-etq">Su ocasión:</span>
        <div role="radiogroup" aria-labelledby="oc-etq" class="opciones">${st.fam.ocasiones.map((o) => `<button type="button" role="radio" aria-checked="${h.ocasion === o.id}" class="opcion" data-accion="hojaOcasion" data-valor="${o.id}" style="${opc(h.ocasion === o.id, '#24402f')}">${esc(o.icono || '')} ${esc(o.nombre)}</button>`).join('')}</div></div>` : ''}`;
  } else if (h.tipo === 'ocasion') {
    titulo = h.id ? 'Editar ocasión' : 'Nueva ocasión';
    boton = h.id ? 'Guardar' : 'Crear ocasión';
    cuerpo = `
      <div class="dos-col" style="grid-template-columns:minmax(0,3fr) minmax(0,1fr)">
        <div class="celda"><label for="h-nombre" class="maquina">Nombre:</label><input id="h-nombre" class="campo-ficha" data-hoja="nombre" type="text" maxlength="60" value="${esc(h.nombre)}" placeholder="Ej.: Cumple de Lucas"></div>
        <div class="celda"><label for="h-emoji" class="maquina">Icono:</label><input id="h-emoji" class="campo-ficha emoji-campo" data-hoja="emoji" type="text" value="${esc(h.emoji)}" placeholder="+"></div>
      </div>
      <div class="dos-col">
        <div class="celda"><label for="h-dia" class="maquina">Día:</label><input id="h-dia" class="campo-ficha" data-hoja="dia" type="text" inputmode="numeric" maxlength="2" value="${esc(h.dia)}" placeholder="25"></div>
        <div class="celda"><label for="h-mes" class="maquina">Mes:</label><select id="h-mes" class="campo-ficha" data-hoja="mes"><option value="">Sin fecha</option>${MESES_LARGOS.map((m, i) => `<option value="${i + 1}" ${String(h.mes) === String(i + 1) ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      </div>`;
  }
  const ok = (h.nombre || '').trim() && (h.tipo !== 'persona' || h.rol !== 'familiar' || h.ocasion);
  return `
  <div class="velo velo-casa">
    <form class="ficha" role="dialog" aria-modal="true" aria-labelledby="hc-t" data-form="hojaCasa" novalidate>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <h2 id="hc-t" class="grano titulo" style="margin:0;font-size:21px">${titulo}</h2>
        <button type="button" class="cerrar" aria-label="Cerrar" data-accion="cerrarHoja">${CERRAR}</button>
      </div>
      <div class="tabla">${cuerpo}</div>
      ${st.error ? `<p class="aviso">${esc(st.error)}</p>` : ''}
      <button type="submit" class="boton boton-peq" id="btn-hoja" style="align-self:center" ${ok && !st.ocupado ? '' : 'disabled'}>${st.ocupado ? 'Guardando…' : boton}</button>
    </form>
  </div>`;
}

// ---------- Acciones de tareas y casa ----------
async function recargarFamilia() { await cargarFamilia(); render(); }
function lanzarTarjeta(direccion, despues) {
  st.tareas.saliendo = direccion;
  render();
  setTimeout(async () => {
    st.tareas.saliendo = '';
    try { await despues(); } catch (e) { fallo(e, 'No hemos podido guardarlo. Inténtalo de nuevo.'); return; }
    render();
  }, 300);
}
function tarjetaActual() {
  const t = st.tareas;
  const cola = t.pestana === 'revisar' && t.sub === 'ocasion' ? colaSinOcasion() : colaAdoptar();
  return cola[0];
}
Object.assign(acciones, {
  pestanaTareas(v) { st.tareas.pestana = v; st.tareas.saltados = []; render(); },
  subRevisar(v) { st.tareas.sub = v; st.tareas.saltados = []; render(); },
  saltarTarjeta() {
    const r = tarjetaActual(); if (!r) return;
    lanzarTarjeta('izq', async () => { st.tareas.saltados = st.tareas.saltados.filter((x) => x !== r.id).concat([r.id]); });
  },
  adoptarTarjeta() {
    const r = tarjetaActual(); if (!r) return;
    lanzarTarjeta('der', async () => {
      const { data, error } = await sb.rpc('adoptar_regalo', { p_regalo: r.id });
      if (error) throw error;
      if (!data) { st.error = 'Otro elfo se te ha adelantado con ese regalo.'; }
      await cargarFamilia();
    });
  },
  asignarElfo(v) {
    const r = tarjetaActual(); if (!r) return;
    lanzarTarjeta('der', async () => {
      const { error } = await sb.rpc('asignar_elfo', { p_regalo: r.id, p_elfo: v });
      if (error) throw error;
      await cargarFamilia();
    });
  },
  asignarOcasion(v) {
    const r = tarjetaActual(); if (!r) return;
    lanzarTarjeta('der', async () => {
      const { error } = await sb.from('regalos').update({ ocasion_id: v }).eq('id', r.id);
      if (error) throw error;
      await cargarFamilia();
    });
  },
  abrirTarea(id) {
    const r = st.fam.regalos.find((x) => x.id === id); if (!r) return;
    st.tareas.ficha = { id, estado: r.estado === 'entregado' ? 'envuelto' : r.estado, precio: r.precio != null ? String(r.precio).replace('.', ',') : '', pagado: r.pagado_por_perfil_id || st.perfil.id, escondite: r.escondite || '' };
    render();
  },
  cerrarTarea() { st.tareas.ficha = null; render(); },
  estadoTarea(v) { st.tareas.ficha.estado = v; render(); },
  pagadoTarea(v) { st.tareas.ficha.pagado = v; render(); },
  nuevoRegaloSorpresa(para) { st.tareas.nuevo = { para: para || '', nombre: '', tienda: '', talla: '', enlace: '', observaciones: '' }; render(); },
  cerrarNuevo() { st.tareas.nuevo = null; render(); },
  paraNuevo(v) { st.tareas.nuevo.para = v; render(); },
  pestanaCasa(v) { Object.assign(st.casa, { pestana: v, persona: null, ocasion: null }); render(); },
  abrirPersona(v) { st.casa.persona = v; render(); app.querySelector('.scroll-casa')?.scrollTo(0, 0); },
  cerrarPersona() { st.casa.persona = null; render(); },
  abrirOcasion(v) { st.casa.ocasion = v; render(); app.querySelector('.scroll-casa')?.scrollTo(0, 0); },
  cerrarOcasion() { st.casa.ocasion = null; render(); },
  nuevoMiembro() { st.error = ''; st.casa.hoja = { tipo: 'persona', id: null, nombre: '', emoji: '', rol: 'nino', gestor: st.perfil.id, ocasion: '' }; render(); },
  editarPersona(v) {
    const p = persona(v); if (!p) return;
    st.error = '';
    st.casa.hoja = { tipo: 'persona', id: p.id, nombre: p.nombre || '', emoji: p.emoji || '', rol: p.rol, gestor: p.gestionado_por || '', ocasion: p.ocasion_id || '', fotoUrl: p.foto_url || '', fotoFile: null };
    render();
  },
  regaloParaPersona(v) { st.pantalla = 'tareas'; acciones.nuevoRegaloSorpresa(v); },
  nuevaOcasion() { st.error = ''; st.casa.hoja = { tipo: 'ocasion', id: null, nombre: '', emoji: '', dia: '', mes: '' }; render(); },
  editarOcasion(v) {
    const o = st.fam.ocasiones.find((x) => x.id === v); if (!o) return;
    st.error = '';
    st.casa.hoja = { tipo: 'ocasion', id: o.id, nombre: o.nombre, emoji: o.icono || '', dia: o.dia || '', mes: o.mes || '' };
    render();
  },
  cerrarHoja() { st.casa.hoja = null; st.error = ''; render(); },
  hojaRol(v) { st.casa.hoja.rol = v; render(); },
  hojaGestor(v) { st.casa.hoja.gestor = v; render(); },
  hojaOcasion(v) { st.casa.hoja.ocasion = v; render(); },
  async copiarEnlace(url) {
    try { await navigator.clipboard.writeText(url); } catch (e) { window.prompt('Copia el enlace:', url); }
    st.casa.copiado = true; render();
    setTimeout(() => { st.casa.copiado = false; if (st.pantalla === 'casa') render(); }, 2000);
  },
  async compartirEnlace(url) {
    const texto = `🎄 ¡Ya está abierta la Lista de Navidad! Entra aquí, pon tu correo y escribe tu carta: ${url}\nTe llegará un código de 6 cifras (si no lo ves, mira en spam).`;
    if (navigator.share) { try { await navigator.share({ title: 'Lista de Navidad', text: texto }); } catch (e) {} }
    else acciones.copiarEnlace(url);
  },
  async saldar(v) {
    const { error } = await sb.rpc('saldar_elfo', { p_familia: st.perfil.familia_id, p_elfo: v });
    if (error) return fallo(error, 'No hemos podido marcarlo como devuelto.');
    await recargarFamilia();
  }
});

async function guardarTarea() {
  const f = st.tareas.ficha;
  const precio = f.precio.trim() ? Number(f.precio.replace(/\s|€/g, '').replace(',', '.')) : null;
  if (f.precio.trim() && !(precio >= 0)) { st.error = 'Escribe el precio como 12,50'; return render(); }
  st.ocupado = true; render();
  const { error } = await sb.from('regalos').update({ estado: f.estado, precio, pagado_por_perfil_id: f.pagado || null, escondite: f.escondite.trim() || null }).eq('id', f.id);
  st.ocupado = false;
  if (error) return fallo(error, 'No hemos podido guardar los cambios.');
  st.tareas.ficha = null;
  await recargarFamilia();
}
async function guardarNuevoRegalo() {
  const f = st.tareas.nuevo;
  if (!f.para || !f.nombre.trim()) return;
  st.ocupado = true; render();
  const { error } = await sb.rpc('crear_regalo_para', { p_para: f.para, p_nombre: f.nombre, p_tienda: f.tienda, p_talla: f.talla, p_enlace: f.enlace, p_observaciones: f.observaciones });
  st.ocupado = false;
  if (error) return fallo(error, 'No hemos podido apuntar el regalo.');
  st.tareas.nuevo = null; st.tareas.pestana = 'pendientes';
  await cargarFamilia();
  ir('tareas');
}
async function guardarHojaCasa() {
  const h = st.casa.hoja;
  const fam = st.perfil.familia_id;
  st.ocupado = true; st.error = ''; render();
  let error;
  if (h.tipo === 'persona') {
    const datos = { nombre: h.nombre.trim(), emoji: h.emoji || null, rol: h.rol, gestionado_por: h.rol === 'nino' ? (h.gestor || null) : null, ocasion_id: h.rol === 'familiar' ? (h.ocasion || null) : null };
    if (h.fotoFile) { const url = await subirFoto(h.fotoFile); if (url) datos.foto_url = url; }
    if (h.id) {
      const p = persona(h.id);
      if (p && p.user_id) delete datos.gestionado_por;
      ({ error } = await sb.from('perfiles').update(datos).eq('id', h.id));
    } else {
      ({ error } = await sb.from('perfiles').insert(Object.assign({ familia_id: fam }, datos)));
    }
  } else {
    const dia = parseInt(h.dia, 10), mes = parseInt(h.mes, 10);
    const conFecha = dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12;
    const datos = { nombre: h.nombre.trim(), icono: h.emoji || '🎉', dia: conFecha ? dia : null, mes: conFecha ? mes : null };
    if (h.id) ({ error } = await sb.from('ocasiones').update(datos).eq('id', h.id));
    else ({ error } = await sb.from('ocasiones').insert(Object.assign({ familia_id: fam, orden: st.fam.ocasiones.length + 1 }, datos)));
  }
  st.ocupado = false;
  if (error) return fallo(error, 'No hemos podido guardarlo.');
  const eraYo = h.tipo === 'persona' && h.id === st.perfil.id;
  st.casa.hoja = null;
  if (eraYo) { await cargar(); return; }
  await recargarFamilia();
}

// Candado del modo niño: mantener pulsado para salir
(function candado() {
  let temporizador = null;
  const cancelar = () => { clearTimeout(temporizador); temporizador = null; document.getElementById('candado')?.classList.remove('pulsando'); };
  app.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('#candado'); if (!b) return;
    e.preventDefault();
    b.classList.add('pulsando');
    temporizador = setTimeout(async () => { temporizador = null; st.cartaDe = null; st.ficha = null; await cargarCarta(); st.popup = false; render(); }, 1500);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => app.addEventListener(ev, (e) => { if (temporizador && (ev !== 'pointerleave' || e.target.closest('#candado'))) cancelar(); }, true));
  app.addEventListener('contextmenu', (e) => { if (e.target.closest('#candado')) e.preventDefault(); });
})();

// Arrastrar la tarjeta de Adoptar
(function arrastre() {
  let x0 = null, el = null, dx = 0;
  app.addEventListener('pointerdown', (e) => {
    const t = e.target.closest('[data-swipe="1"]');
    if (!t || e.target.closest('a,button')) return;
    el = t; x0 = e.clientX; dx = 0;
    el.classList.add('arrastrando');
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
  });
  app.addEventListener('pointermove', (e) => {
    if (!el) return;
    dx = e.clientX - x0;
    el.style.transform = `translateX(${dx}px) rotate(${(dx / 18).toFixed(1)}deg)`;
    el.style.setProperty('--si', String(Math.max(0, Math.min(1, dx / 110))));
    el.style.setProperty('--no', String(Math.max(0, Math.min(1, -dx / 110))));
  });
  const soltar = () => {
    if (!el) return;
    const d = dx; const t = el; el = null;
    t.classList.remove('arrastrando');
    if (d > 110) acciones.adoptarTarjeta();
    else if (d < -110) acciones.saltarTarjeta();
    else { t.style.transform = ''; t.style.setProperty('--si', '0'); t.style.setProperty('--no', '0'); }
  };
  app.addEventListener('pointerup', soltar);
  app.addEventListener('pointercancel', soltar);
})();

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
  } else if (t.dataset.tarea) {
    st.tareas.ficha[t.dataset.tarea] = t.value;
  } else if (t.dataset.nuevo) {
    st.tareas.nuevo[t.dataset.nuevo] = t.value;
    const btn = document.getElementById('btn-nuevo'); if (btn) btn.disabled = !(st.tareas.nuevo.para && st.tareas.nuevo.nombre.trim());
  } else if (t.dataset.hoja) {
    let v = t.value;
    if (t.dataset.hoja === 'emoji') { v = ultimoGrafema(v); t.value = v; }
    if (t.dataset.hoja === 'dia') { v = v.replace(/\D/g, '').slice(0, 2); t.value = v; }
    st.casa.hoja[t.dataset.hoja] = v;
    const h = st.casa.hoja;
    const btn = document.getElementById('btn-hoja'); if (btn) btn.disabled = !((h.nombre || '').trim() && (h.tipo !== 'persona' || h.rol !== 'familiar' || h.ocasion));
  } else if (t.dataset.ficha) {
    st.ficha[t.dataset.ficha] = t.value;
    const btn = document.getElementById('btn-regalo'); if (btn) btn.disabled = !st.ficha.nombre.trim();
  }
});

app.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'portado') acciones.portado(t.value);
  else if (t.dataset.hoja === 'mes') st.casa.hoja.mes = t.value;
  else if (t.dataset.hojaFoto && t.files && t.files[0]) {
    st.casa.hoja.fotoFile = t.files[0];
    st.casa.hoja.fotoUrl = URL.createObjectURL(t.files[0]);
    render();
  }
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
  const fm = e.target.dataset.form;
  if (fm) e.preventDefault();
  if (fm === 'ficha') guardarRegalo();
  else if (fm === 'tarea') guardarTarea();
  else if (fm === 'nuevoRegalo') guardarNuevoRegalo();
  else if (fm === 'hojaCasa') guardarHojaCasa();
});
app.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'remite') { const b = document.getElementById('btn-correo'); if (b && !b.disabled) acciones.enviarCorreo(); }
  if (e.key === 'Escape' && st.ficha) acciones.cerrarFicha();
  if (e.key === 'Escape' && st.tareas.ficha) acciones.cerrarTarea();
  if (e.key === 'Escape' && st.tareas.nuevo) acciones.cerrarNuevo();
  if (e.key === 'Escape' && st.casa.hoja) acciones.cerrarHoja();
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
  st.perfil.id = 'yo';
  st.ninos = demo === 'nino' ? [{ id: 'lucas', nombre: 'Lucas', emoji: '🦖' }] : [{ id: 'lucas', nombre: 'Lucas', emoji: '🦖' }];
  st.fam = {
    codigo: '50E36000',
    perfiles: [
      { id: 'yo', nombre: 'Willy', emoji: '🦊', rol: 'jefe', user_id: 'demo' },
      { id: 'ana', nombre: 'Ana', emoji: '🎅', rol: 'jefe', user_id: 'x1' },
      { id: 'pablo', nombre: 'Pablo', emoji: '⛄', rol: 'elfo', user_id: 'x2' },
      { id: 'elena', nombre: 'Elena', emoji: '🦌', rol: 'elfo', user_id: 'x3' },
      { id: 'lucas', nombre: 'Lucas', emoji: '🦖', rol: 'nino', gestionado_por: 'yo' },
      { id: 'martina', nombre: 'Martina', emoji: '🎨', rol: 'nino', user_id: 'x4' },
      { id: 'carmen', nombre: 'Abuela Carmen', emoji: '🧶', rol: 'familiar', ocasion_id: 'abuelos' }
    ],
    ocasiones: [{ id: 'reyes', nombre: 'Reyes', icono: '👑', mes: 1, dia: 6 }, { id: 'nino', nombre: 'Niño Jesús', icono: '⭐', mes: 12, dia: 25 }, { id: 'abuelos', nombre: 'Abuelos', icono: '🧓', mes: 11, dia: 15 }, { id: 'pasteles', nombre: 'Pasteles', icono: '🎂' }],
    regalos: [
      { id: 'r1', para_perfil_id: 'lucas', nombre: 'Patines en línea', tienda: 'Decathlon', talla: '34–37', observaciones: 'Ajustables, con protecciones', enlace: 'https://a.es https://b.es', estado: 'pendiente' },
      { id: 'r2', para_perfil_id: 'carmen', nombre: 'Manta para el sofá', tienda: 'El Corte Inglés', estado: 'pendiente' },
      { id: 'r3', para_perfil_id: 'martina', nombre: 'Pijama de renos', elfo_perfil_id: 'yo', ocasion_id: 'reyes', estado: 'pedido', precio: 24.9, pagado_por_perfil_id: 'yo' },
      { id: 'r4', para_perfil_id: 'lucas', nombre: 'Linterna frontal', elfo_perfil_id: 'yo', ocasion_id: 'reyes', estado: 'en_casa', escondite: 'Armario del pasillo' },
      { id: 'r5', para_perfil_id: 'ana', nombre: 'Novela de misterio', elfo_perfil_id: 'pablo', ocasion_id: 'nino', estado: 'envuelto', precio: 19.9, pagado_por_perfil_id: 'pablo' },
      { id: 'r6', para_perfil_id: 'pablo', nombre: 'Zapatillas de running', elfo_perfil_id: 'elena', estado: 'pedido', precio: 64, pagado_por_perfil_id: 'elena' },
      { id: 'r7', para_perfil_id: 'elena', nombre: 'Taza de cerámica', elfo_perfil_id: 'yo', ocasion_id: 'nino', estado: 'pendiente' }
    ]
  };
  if (demo === 'nino') { st.cartaDe = 'lucas'; ir('carta'); }
  else if (demo.startsWith('tareas')) { st.tareas.pestana = demo.split('-')[1] || 'adoptar'; ir('tareas'); }
  else if (demo.startsWith('casa')) { st.casa.pestana = demo.split('-')[1] || 'familia'; ir('casa'); }
  else ir(demo);
} else {
  cargar().catch((e) => fallo(e));
}
