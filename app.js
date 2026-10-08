/* ===== DATOS BASE ===== */
const HOUSES = [
  { id: 'tagaste', name: 'Tagaste', color: '#E3A92B', text: '#fff', img: 'jpg/tagaste.JPG' },
  { id: 'cartago', name: 'Cartago', color: '#C4262E', text: '#fff', img: 'jpg/cartago.JPG' },
  { id: 'hipona',  name: 'Hipona',  color: '#FFFFFF', text: '#1E3A66', img: 'jpg/hipona.JPG' },
  { id: 'milan',   name: 'Milán',   color: '#1E3F73', text: '#fff', img: 'jpg/milan.JPG' }
];
const RETOS = [
  'Me expreso y comparto respetando la dignidad de los demás',
  'Promuevo el buen trato comunitario contra el hostigamiento, la violencia y el acoso escolar',
  'Interiorizo mi responsabilidad sobre mis circunstancias',
  'Porto los materiales y útiles para cada clase evitando distractores',
  'Colaboro y ayudo a mis compañeros dentro de aula',
  'Participo activamente dentro de aula',
  'Promuevo la limpieza y el cuidado de los bienes particulares y comunes',
  'Llego puntualmente al colegio y a mis clases',
  'Cuido mi aseo, presentación personal y uniforme',
  'Me expreso con amabilidad al saludar, interrumpir, errar, solicitar algo y/o agradecer'
];
const LEVELS = { 1: [0, 2], 2: [3, 6], 3: [7, 9] };           // índices de RETOS por nivel
const CATS_FAVOR = ['Gesto puntual', 'Constancia', 'Ejemplo para otros', 'Excepcional'];
const CATS_CONTRA = ['Leve', 'Moderada', 'Grave', 'Reincidencia'];
const MAX_DOCENTES = 10;

/* ===== FIREBASE ===== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, deleteUser }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, onSnapshot, writeBatch, deleteDoc }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyArP3RB3N2HTAcu4zE2d7XM5mvtMB3-lgg",
  authDomain: "casasagustinas.firebaseapp.com",
  projectId: "casasagustinas",
  storageBucket: "casasagustinas.firebasestorage.app",
  messagingSenderId: "947871280638",
  appId: "1:947871280638:web:a518643a3de4ce770224af"
};
const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp), db = getFirestore(fbApp);
const MAIL = '@torneo-casasagustinas.app';   // el docente entra con "usuario"; Firebase lo guarda como correo interno

let ALL = [];            // registros de la semana actual y la anterior (en vivo)
let unsub = null, registering = false;

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const house = id => HOUSES.find(h => h.id === id);

/* ===== SEMANA: cierra cada viernes a las 4:00 p. m. ===== */
function weekStart(now = new Date()) {
  const c = new Date(now);
  c.setDate(c.getDate() - ((c.getDay() - 5 + 7) % 7));
  c.setHours(16, 0, 0, 0);
  if (c > now) c.setDate(c.getDate() - 7);
  return c;
}
function weekEnd() { const e = weekStart(); e.setDate(e.getDate() + 7); return e; }
const fmtLong = d => d.toLocaleString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true });
function renderWeek() {
  const now = new Date(), friday = now.getDay() === 5 && now.getHours() < 16;
  const w = $('week');
  w.className = 'week' + (friday ? ' alert' : '');
  w.innerHTML = `<b>Semana actual:</b> ${fmtLong(weekStart())} a ${fmtLong(weekEnd())}.<br>` +
    (friday ? '<b>Hoy a las 4:00 p. m. los puntos vuelven a cero.</b> Descarga el Excel antes de esa hora.'
            : 'Los puntos se reinician a cero cada viernes a las 4:00 p. m.');
  $('btnPrev').hidden = !prevRecs().length;
  $('btnReset').hidden = !isAdmin();
}

let state = { type: 'favor', level: 1, user: null };
const getRecs = () => ALL.filter(x => x.ts >= weekStart().getTime());
const prevRecs = () => ALL.filter(x => x.ts < weekStart().getTime());
const isAdmin = () => state.user && state.user.rol === 'admin';

/* ===== ESCUDOS ===== */
function shieldSVG(h) {
  const stroke = h.id === 'hipona' ? '#1E3A66' : 'rgba(0,0,0,.18)';
  return `<svg viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Escudo ${h.name}">
    <path d="M10 10h100v60c0 34-24 53-50 62C34 123 10 104 10 70z" fill="${h.color}" stroke="${stroke}" stroke-width="3"/>
    <text x="60" y="38" text-anchor="middle" font-family="Nunito Sans,sans-serif" font-weight="700" font-size="14" fill="${h.text}">${h.name.toUpperCase()}</text>
    <path d="M60 106C38 90 36 66 48 60c7-3 12 1 12 6 0-5 5-9 12-6 12 6 10 30-12 46z" fill="none" stroke="${h.text}" stroke-width="4"/>
    <path d="M60 94c-8-8-9-14-6-17 3-2 6 1 6 4 0-3 3-6 6-4 3 3 2 9-6 17z" fill="${h.text}"/></svg>`;
}
function showShield() {
  const h = house($('house').value), box = $('shield');
  // Intenta usar la imagen real (carpeta img/); si no existe, usa el escudo dibujado.
  const im = new Image();
  im.alt = 'Escudo ' + h.name;
  im.onload = () => { box.innerHTML = ''; box.appendChild(im); };
  im.onerror = () => { box.innerHTML = shieldSVG(h); };
  box.innerHTML = shieldSVG(h);
  im.src = h.img;
}

/* ===== ACCESO ===== */
function authMsg(t, err = true) { const m = $('authMsg'); m.textContent = t; m.className = 'msg' + (err ? ' err' : ''); }
const cleanUser = v => v.trim().toLowerCase();
const validUser = u => /^[a-z0-9._-]{3,20}$/.test(u);
const authError = e => ({
  'auth/email-already-in-use': 'Ese usuario ya existe. Elige otro.',
  'auth/invalid-credential': 'Usuario o contraseña incorrectos.',
  'auth/wrong-password': 'Usuario o contraseña incorrectos.',
  'auth/user-not-found': 'Usuario o contraseña incorrectos.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/network-request-failed': 'Sin conexión a internet.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.'
}[e.code] || 'No se pudo completar la acción (' + (e.code || e.message) + ').');

document.querySelectorAll('#authTabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('#authTabs button').forEach(x => x.classList.toggle('on', x === b));
  $('loginForm').hidden = b.dataset.t !== 'login';
  $('regForm').hidden = b.dataset.t !== 'register';
  authMsg('');
});

$('regForm').onsubmit = async e => {
  e.preventDefault();
  const u = cleanUser($('rUser').value), btn = e.target.querySelector('button');
  if (!validUser(u)) return authMsg('El usuario debe tener de 3 a 20 letras o números, sin espacios.');
  btn.disabled = true; registering = true; authMsg('Creando acceso…', false);
  let cred = null;
  try {
    cred = await createUserWithEmailAndPassword(auth, u + MAIL, $('rPass').value);
    const docentes = await getDocs(collection(db, 'docentes'));
    if (docentes.size >= MAX_DOCENTES) throw { code: 'cupo' };
    const profile = { name: $('rName').value.trim(), user: u, rol: 'docente', codigo: $('rCode').value.trim() };
    await setDoc(doc(db, 'docentes', cred.user.uid), profile);
    e.target.reset(); registering = false;
    start({ uid: cred.user.uid, ...profile });
  } catch (err) {
    if (cred) { try { await deleteUser(cred.user); } catch { await signOut(auth); } }
    registering = false;
    authMsg(err.code === 'cupo' ? 'Ya se registraron los 10 docentes.'
      : err.code === 'permission-denied' ? 'El código de acceso no es correcto.' : authError(err));
  }
  btn.disabled = false;
};

$('loginForm').onsubmit = async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button'); btn.disabled = true; authMsg('Ingresando…', false);
  try { await signInWithEmailAndPassword(auth, cleanUser($('lUser').value) + MAIL, $('lPass').value); e.target.reset(); authMsg(''); }
  catch (err) { authMsg(authError(err)); }
  btn.disabled = false;
};
$('btnLogout').onclick = async () => { if (unsub) unsub(); await signOut(auth); location.reload(); };

onAuthStateChanged(auth, async fb => {
  if (registering) return;
  if (!fb) { $('auth').hidden = false; $('app').hidden = true; $('userBar').hidden = true; return; }
  try {
    const snap = await getDoc(doc(db, 'docentes', fb.uid));
    if (!snap.exists()) { await signOut(auth); return authMsg('Tu cuenta no está autorizada.'); }
    start({ uid: fb.uid, ...snap.data() });
  } catch (err) { authMsg('No se pudo cargar tu perfil. Revisa tu conexión.'); }
});

function start(user) {
  state.user = user;
  $('auth').hidden = true; $('app').hidden = false; $('userBar').hidden = false;
  $('userName').textContent = user.name + (user.rol === 'admin' ? ' (coordinador)' : '');
  const from = weekStart(); from.setDate(from.getDate() - 7);            // semana actual + anterior
  if (unsub) unsub();
  unsub = onSnapshot(query(collection(db, 'registros'), where('ts', '>=', from.getTime()), orderBy('ts')),
    s => { ALL = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); },
    err => { console.error(err); $('saveMsg').className = 'msg err'; $('saveMsg').textContent = 'No se pudieron leer los puntos: ' + err.code; });
  renderAll();
}

/* ===== FORMULARIO ===== */
function fillRetos() {
  const [a, b] = LEVELS[state.level];
  $('reto').innerHTML = RETOS.slice(a, b + 1).map((r, i) => `<option value="${a + i}">${String(a + i + 1).padStart(2, '0')}. ${esc(r)}</option>`).join('');
}
function setTitle() {
  const h = house($('house').value).name.toUpperCase();
  $('formTitle').textContent = (state.type === 'favor' ? 'PUNTOS A FAVOR' : 'PUNTOS EN CONTRA') + ': CASA ' + h;
}
$('house').innerHTML = HOUSES.map(h => `<option value="${h.id}">${h.name}</option>`).join('');
$('house').onchange = () => { showShield(); setTitle(); };
document.querySelectorAll('#typeTabs button').forEach(b => b.onclick = () => {
  state.type = b.dataset.t;
  document.querySelectorAll('#typeTabs button').forEach(x => x.classList.toggle('on', x === b));
  $('fieldsFavor').hidden = state.type !== 'favor';
  $('fieldsContra').hidden = state.type !== 'contra';
  setTitle(); $('saveMsg').textContent = '';
});
document.querySelectorAll('#levels button').forEach(b => b.onclick = () => {
  state.level = +b.dataset.n;
  document.querySelectorAll('#levels button').forEach(x => x.classList.toggle('on', x === b));
  fillRetos();
});

$('btnSave').onclick = () => {
  const m = $('saveMsg'); m.className = 'msg';
  const num = id => Math.max(0, Math.floor(+$(id).value || 0));
  const items = state.type === 'favor'
    ? [[CATS_FAVOR[0], num('f_gesto')], [CATS_FAVOR[1], $('f_const').checked ? 20 : 0],
       [CATS_FAVOR[2], $('f_ejemplo').checked ? 50 : 0], [CATS_FAVOR[3], num('f_exc')]]
    : [[CATS_CONTRA[0], num('c_leve')], [CATS_CONTRA[1], num('c_mod')],
       [CATS_CONTRA[2], num('c_grave')], [CATS_CONTRA[3], num('c_reinc')]];
  const valid = items.filter(i => i[1] > 0);
  if (!valid.length) { m.className = 'msg err'; m.textContent = 'Escribe o selecciona al menos un puntaje.'; return; }
  const now = Date.now(), batch = writeBatch(db), btn = $('btnSave');
  valid.forEach(([cat, pts], i) => batch.set(doc(collection(db, 'registros')), {
    ts: now + i, uid: state.user.uid, teacher: state.user.name, house: $('house').value, type: state.type,
    level: state.level, reto: +$('reto').value, cat, pts, note: $('note').value.trim()
  }));
  btn.disabled = true;
  batch.commit().then(() => {
    document.querySelectorAll('#app input[type=number]').forEach(i => i.value = '');
    document.querySelectorAll('#app input[type=checkbox]').forEach(i => i.checked = false);
    $('note').value = '';
    m.textContent = `Registrado: ${valid.reduce((s, i) => s + i[1], 0)} puntos para ${house($('house').value).name}.`;
  }).catch(err => { m.className = 'msg err'; m.textContent = 'No se pudo guardar: ' + err.code; })
    .finally(() => btn.disabled = false);
};

/* ===== TABLAS Y GRÁFICO ===== */
function totals(r = getRecs()) {
  return HOUSES.map(h => {
    const f = r.filter(x => x.house === h.id && x.type === 'favor').reduce((s, x) => s + x.pts, 0);
    const c = r.filter(x => x.house === h.id && x.type === 'contra').reduce((s, x) => s + x.pts, 0);
    return { h, favor: f, contra: c, neto: f - c };
  });
}
function catMatrix(r = getRecs()) {
  const cols = [...CATS_FAVOR.map(c => ['favor', c]), ...CATS_CONTRA.map(c => ['contra', c])];
  return { cols, rows: HOUSES.map(h => ({ h, vals: cols.map(([t, c]) => r.filter(x => x.house === h.id && x.type === t && x.cat === c).reduce((s, x) => s + x.pts, 0)) })) };
}
const fmtDate = ts => new Date(ts).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function renderSummary() {
  const t = totals();
  $('tSummary').innerHTML = '<tr><th>Casa</th><th class="n">A favor</th><th class="n">En contra</th><th class="n">Total</th></tr>' +
    t.map(x => `<tr><td>${x.h.name}</td><td class="n pos">${x.favor}</td><td class="n neg">${x.contra}</td><td class="n"><b>${x.neto}</b></td></tr>`).join('');
  // gráfico de barras
  const max = Math.max(10, ...t.flatMap(x => [x.favor, x.contra])), base = 190, hh = 150;
  let s = `<line x1="10" y1="${base}" x2="330" y2="${base}" stroke="var(--line)"/>`;
  t.forEach((x, i) => {
    const gx = 22 + i * 80, bf = x.favor / max * hh, bc = x.contra / max * hh;
    s += `<rect x="${gx}" y="${base - bf}" width="28" height="${bf}" rx="4" fill="var(--fav)"/>
      <rect x="${gx + 30}" y="${base - bc}" width="28" height="${bc}" rx="4" fill="var(--con)"/>
      <text x="${gx + 14}" y="${base - bf - 5}" text-anchor="middle" font-size="11" fill="var(--ink)">${x.favor}</text>
      <text x="${gx + 44}" y="${base - bc - 5}" text-anchor="middle" font-size="11" fill="var(--ink)">${x.contra}</text>
      <text x="${gx + 29}" y="212" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)">${x.h.name}</text>
      <text x="${gx + 29}" y="228" text-anchor="middle" font-size="11" fill="var(--muted)">Total ${x.neto}</text>`;
  });
  $('chart').innerHTML = s;
}
function renderCats() {
  const { cols, rows } = catMatrix();
  $('tCats').innerHTML = '<tr><th>Casa</th>' + cols.map(([t, c]) => `<th class="n">${c}${t === 'contra' ? ' (−)' : ''}</th>`).join('') + '</tr>' +
    rows.map(r => `<tr><td>${r.h.name}</td>${r.vals.map(v => `<td class="n">${v}</td>`).join('')}</tr>`).join('');
}
function renderRecords() {
  const r = getRecs().slice().reverse();
  if (!r.length) { $('tRecords').innerHTML = '<tr><td class="empty">Aún no hay registros. Selecciona una casa y registra los primeros puntos.</td></tr>'; return; }
  $('tRecords').innerHTML = '<tr><th>Fecha</th><th>Casa</th><th>Tipo</th><th>Categoría</th><th class="n">Pts</th><th>Docente</th><th></th></tr>' +
    r.map(x => `<tr><td>${fmtDate(x.ts)}</td><td>${house(x.house).name}</td><td>${x.type === 'favor' ? 'A favor' : 'En contra'}</td>
      <td>${x.cat}</td><td class="n ${x.type === 'favor' ? 'pos' : 'neg'}">${x.type === 'favor' ? '+' : '−'}${x.pts}</td><td>${esc(x.teacher)}</td>
      <td>${(x.uid === state.user.uid || isAdmin()) ? `<button class="del" data-id="${x.id}" aria-label="Eliminar registro">×</button>` : ''}</td></tr>`).join('');
  document.querySelectorAll('.del').forEach(b => b.onclick = () => {
    if (!confirm('¿Eliminar este registro?')) return;
    deleteDoc(doc(db, 'registros', b.dataset.id)).catch(err => alert('No se pudo eliminar: ' + err.code));
  });
}
function renderInfo() {
  const names = ['Nivel I', 'Nivel II', 'Nivel III'];
  $('retosInfo').innerHTML = [1, 2, 3].map(n => {
    const [a, b] = LEVELS[n];
    return `<h3>${names[n - 1]}: ${String(a + 1).padStart(2, '0')} a ${String(b + 1).padStart(2, '0')}</h3><ol>` +
      RETOS.slice(a, b + 1).map((r, i) => `<li><b>${String(a + i + 1).padStart(2, '0')}.</b> ${esc(r)}</li>`).join('') + '</ol>';
  }).join('');
}
function renderAll() { renderWeek(); renderSummary(); renderCats(); renderRecords(); }

/* ===== EXCEL ===== */
function exportExcel(recs, name) {
  if (typeof XLSX === 'undefined') return alert('No se pudo cargar la herramienta de Excel. Revisa tu conexión a internet.');
  const t = totals(recs), { cols, rows } = catMatrix(recs);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(t.map(x => ({ Casa: x.h.name, 'Puntos a favor': x.favor, 'Puntos en contra': x.contra, 'Total': x.neto }))), 'Resumen');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.map(r => {
    const o = { Casa: r.h.name };
    cols.forEach(([tp, c], i) => o[(tp === 'favor' ? 'A favor - ' : 'En contra - ') + c] = r.vals[i]);
    return o;
  })), 'Por categoría');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(recs.map(x => ({
    Fecha: new Date(x.ts).toLocaleString('es-PE'), Casa: house(x.house).name, Tipo: x.type === 'favor' ? 'A favor' : 'En contra',
    Nivel: x.level, Reto: String(x.reto + 1).padStart(2, '0') + '. ' + RETOS[x.reto], Categoría: x.cat,
    Puntos: x.type === 'favor' ? x.pts : -x.pts, Docente: x.teacher, Observación: x.note
  }))), 'Registros');
  XLSX.writeFile(wb, name);
}
const stamp = d => d.toISOString().slice(0, 10);
$('btnExcel').onclick = () => exportExcel(getRecs(), `Torneo_semana_${stamp(weekStart())}.xlsx`);
$('btnPrev').onclick = () => { const a = prevRecs(); exportExcel(a, `Torneo_semana_anterior_${stamp(new Date(Math.min(...a.map(x => x.ts))))}.xlsx`); };
$('btnReset').onclick = async () => {
  if (!isAdmin()) return;
  if (!confirm('¿Reiniciar a cero los puntos de la semana actual de TODAS las casas? Esta acción no se puede deshacer.\n\nSi aún no descargaste el Excel, cancela y descárgalo primero.')) return;
  const ids = getRecs().map(x => x.id);
  try {
    for (let i = 0; i < ids.length; i += 400) {
      const b = writeBatch(db); ids.slice(i, i + 400).forEach(id => b.delete(doc(db, 'registros', id))); await b.commit();
    }
  } catch (err) { alert('No se pudo reiniciar: ' + err.code); }
};

/* ===== INICIO ===== */
fillRetos(); renderInfo(); showShield(); setTitle();
setInterval(() => { if (state.user) renderAll(); }, 60000);   // al llegar el viernes 4:00 p. m. la vista pasa a cero sola
