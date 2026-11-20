(() => {
  'use strict';
  const VER = '?v=10';
  const PRODUCTOS = [
    { nombre: 'Cerise Noire', notas: ['Black cherry', 'Tonka bean', 'Smoked cedar'], precio: 210, p100: 325 },
    { nombre: 'Pétale Nu', notas: ['Pink pepper', 'Iris', 'White musk'], precio: 185, p100: 285 },
    { nombre: 'Ambre Chêne', notas: ['Amber', 'Oakmoss', 'Vanilla bean'], precio: 240, p100: 370 },
    { nombre: 'Cobalt', notas: ['Sea salt', 'Bergamot', 'Blue cedar'], precio: 165, p100: 255 },
    { nombre: 'Vert Nuit', notas: ['Fig leaf', 'Green tea', 'Vetiver'], precio: 260, p100: 405 },
  ];
  const OSCURO_K = 0.55;   
  const $ = (id) => document.getElementById(id);
  const cv = $('vitrina');
  const opciones = { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' };
  const gl = cv.getContext('webgl2', opciones) || cv.getContext('webgl', opciones);
  const GL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  const mqMovil = matchMedia('(max-aspect-ratio:4/5),(max-width:760px)');
  const reducido = matchMedia('(prefers-reduced-motion: reduce)');
  const movil = mqMovil.matches;
  const IMG_A = movil ? 3072 / 5504 : 5504 / 3072;
  let Z = null;

  if (!gl) { document.body.classList.add('listo'); $('pista').textContent = 'This window needs WebGL'; return; }
  document.body.classList.toggle('es-movil', movil);

  /* ---------- WebGL ---------- */
  const VS = `attribute vec2 p;varying vec2 vUv;void main(){vUv=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}`;
  const FS = `precision highp float;
varying vec2 vUv;
uniform sampler2D uLit,uDark,uClose;
uniform vec4 uView,uSub,uZ[5],uSel;
uniform vec2 uF[5],uSelF;
uniform vec3 uM0,uM1;
uniform float uW[5];
uniform float uAll,uK,uReveal,uCloseA,uOut,uTime;
float zona(vec2 p,vec4 r,vec2 f){vec2 d=max(max(r.xy-p,p-r.zw),0.)/f;return exp(-dot(d,d));}
void main(){
  vec2 uv=uView.xy+vUv*uView.zw;
  float bajo=max(uv.y-1.,0.);
  vec2 su=vec2(uv.x,uv.y>1.?2.-uv.y:uv.y);
  vec3 lit=texture2D(uLit,su).rgb;
  vec3 c=lit;
  if(uAll<.999){
    vec3 dk=texture2D(uDark,su).rgb*uK;
    float L=0.;
    for(int j=0;j<5;j++){if(uW[j]>.001)L+=uW[j]*zona(uv,uZ[j],uF[j]);}
    L=mix(clamp(L,0.,1.),1.,uAll);
    c=mix(dk,lit,L);
  }
  if(uCloseA>.001){
    float band=zona(uv,uSel,uSelF);
    vec2 cu=vec2(dot(uM0,vec3(uv,1.)),dot(uM1,vec3(uv,1.)));
    vec2 t=(cu-uSub.xy)/uSub.zw;
    if(t.x>0.&&t.x<1.&&t.y>0.&&t.y<1.){
      float rev=uReveal*uReveal*(3.-2.*uReveal);
      float bordes=smoothstep(0.,.04,t.x)*smoothstep(0.,.04,1.-t.x)*smoothstep(0.,.04,t.y)*smoothstep(0.,.04,1.-t.y);
      vec3 cc=texture2D(uClose,t).rgb;
      c=mix(c,cc,band*rev*uCloseA*bordes);
    }
  }
  if(uOut>.001)c*=mix(1.,.5,uOut*(1.-zona(uv,uSel,uSelF*2.6)));
  c*=1.-.85*smoothstep(0.,.05,bajo);
  gl_FragColor=vec4(c,1.);
}`;
  function shader(tipo, src) {
    const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aP = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  for (const n of ['uLit', 'uDark', 'uClose', 'uView', 'uSub', 'uZ', 'uF', 'uSel', 'uSelF', 'uM0', 'uM1', 'uW',
    'uAll', 'uK', 'uReveal', 'uCloseA', 'uOut', 'uTime']) U[n] = gl.getUniformLocation(prog, n);
  const MAXTEX = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const ANISO = gl.getExtension('EXT_texture_filter_anisotropic');

  /* Con WebGL2 hay mipmaps en texturas de cualquier tamano: al ver una foto de 3840 en una pantalla de 1920
     ya no se salta pixeles (eso la hacia ver granulada, "no parece 4k"). */
  function textura(fuente) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    const mip = GL2 && fuente;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // RGBA conserva el formato nativo de la imagen decodificada.
    if (fuente) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fuente);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([7, 8, 12, 255]));
    if (mip) {
      gl.generateMipmap(gl.TEXTURE_2D);
      if (ANISO) gl.texParameterf(gl.TEXTURE_2D, ANISO.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(ANISO.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    }
    return t;
  }
  async function texturaFluida(im) {
    if (!GL2 || typeof createImageBitmap !== 'function') return textura(im);
    while (vuelo || document.hidden) await pausa(80);
    // Una sola conversion de la foto: recortar directamente el <img> repetia la conversion
    // completa en cada franja y bloqueaba ~550 ms con CPU x4.
    const bitmap = im instanceof ImageBitmap ? im : await createImageBitmap(im, { premultiplyAlpha: 'none' });
    const tex = gl.createTexture(), w = im.width, h = im.height;
    const enlazar = () => { gl.activeTexture(gl.TEXTURE0 + 2); gl.bindTexture(gl.TEXTURE_2D, tex); };
    enlazar();
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texStorage2D(gl.TEXTURE_2D, Math.floor(Math.log2(Math.max(w, h))) + 1, gl.RGBA8, w, h);
    // Por franjas: una subida 4K de golpe bloqueaba el hilo principal. Cada franja cede un fotograma.
    for (let y = 0; y < h; y += 128) {
      while (vuelo || document.hidden) await pausa(80);
      const parte = await createImageBitmap(bitmap, 0, y, w, Math.min(128, h - y), { premultiplyAlpha: 'none' });
      await new Promise(requestAnimationFrame);
      while (vuelo || document.hidden) await pausa(80);
      enlazar(); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y, gl.RGBA, gl.UNSIGNED_BYTE, parte);
      parte.close();
    }
    enlazar(); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    if (ANISO) gl.texParameterf(gl.TEXTURE_2D, ANISO.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(ANISO.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    if (bitmap !== im) bitmap.close();
    return tex;
  }
  let decoder = null, decodeId = 0, photoId = 0, decodeError = null;
  const decodeJobs = new Map();
  if (GL2 && typeof Worker !== 'undefined' && typeof createImageBitmap === 'function') {
    try {
      decoder = new Worker('pluie-images.js' + VER);
      decoder.onmessage = ({ data }) => {
        const job = decodeJobs.get(data.id); if (!job) return;
        decodeJobs.delete(data.id); data.error ? job.reject(new Error(data.error)) : job.resolve(data);
      };
      decoder.onerror = () => {
        for (const job of decodeJobs.values()) job.reject(new Error('Image worker failed'));
        decodeJobs.clear(); decoder.terminate(); decoder = null;
      };
    } catch (_) { }
  }
  function decodeJob(action, options) {
    return new Promise((resolve, reject) => {
      const id = ++decodeId; decodeJobs.set(id, { resolve, reject });
      decoder.postMessage({ id, action, ...options });
    });
  }
  async function texturaUrl(url) {
    if (!decoder) return texturaFluida(await imagen(url));
    const key = ++photoId;
    let tex;
    try {
      const info = await decodeJob('open', { key, url: new URL(url + VER, location.href).href });
      while (vuelo || document.hidden) await pausa(80);
      tex = gl.createTexture();
      const enlazar = () => { gl.activeTexture(gl.TEXTURE0 + 2); gl.bindTexture(gl.TEXTURE_2D, tex); };
      enlazar();
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texStorage2D(gl.TEXTURE_2D, Math.floor(Math.log2(Math.max(info.width, info.height))) + 1, gl.RGBA8, info.width, info.height);
      for (let y = 0; y < info.height; y += 128) {
        while (vuelo || document.hidden) await pausa(80);
        const { bitmap } = await decodeJob('strip', { key, y, height: Math.min(128, info.height - y) });
        await new Promise(requestAnimationFrame);
        while (vuelo || document.hidden) await pausa(80);
        enlazar(); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y, gl.RGBA, gl.UNSIGNED_BYTE, bitmap); bitmap.close();
      }
      enlazar(); gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      if (ANISO) gl.texParameterf(gl.TEXTURE_2D, ANISO.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(ANISO.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      return tex;
    } catch (error) {
      decodeError = error.message;
      if (tex) gl.deleteTexture(tex);
      return texturaFluida(await imagen(url));
    } finally { if (decoder) decodeJob('close', { key }).catch(() => { }); }
  }
  function imagen(src) {
    return new Promise((ok, mal) => { const i = new Image(); i.decoding = 'async'; i.onload = () => (i.decode ? i.decode().catch(() => { }) : Promise.resolve()).then(() => ok(i)); i.onerror = mal; i.src = src + VER; });
  }
  const T = { lit: textura(), dark: textura(), vacia: textura(), cerca: null };

  /* ---------- zonas de luz: escritorio por columnas, movil por cajas (2 arriba, 3 abajo) ---------- */
  function prepararZonas(z) {
    return z.map((o) => movil
      ? { ...o, luzR: o.zona, luzF: o.caida, limpia: o.zona, limpiaF: o.caida, sub: [0, 0, 1, 1] }
      : { ...o, luzR: [o.cx - .052, -1, o.cx + .052, 2], luzF: [.045, 1], limpia: [o.cx - .035, -1, o.cx + .035, 2], limpiaF: [.035, 1], sub: [0, 0, 1, 1] });
  }

  /* ---------- silueta de cada frasco (mascara indexada, valor = n * 40) ---------- */
  const HIT = { w: 0, h: 0, d: null, caja: [] };
  async function cargarSiluetas() {
    const im = await imagen(`media/hit-${movil ? 'movil' : 'escritorio'}.png`);
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
    const px = x.getImageData(0, 0, c.width, c.height).data;
    HIT.w = c.width; HIT.h = c.height; HIT.d = new Uint8Array(c.width * c.height);
    const caja = [0, 1, 2, 3, 4].map(() => [1e9, 1e9, -1, -1]);
    for (let y = 0; y < c.height; y++) for (let xx = 0; xx < c.width; xx++) {
      const v = Math.round(px[(y * c.width + xx) * 4] / 40); HIT.d[y * c.width + xx] = v;
      if (v >= 1 && v <= 5) { const b = caja[v - 1]; b[0] = Math.min(b[0], xx); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], xx); b[3] = Math.max(b[3], y); }
    }
    HIT.caja = caja.map((b) => [b[0] / c.width, b[1] / c.height, (b[2] + 1) / c.width, (b[3] + 1) / c.height]);
  }
  function frascoEn(u) {
    if (!HIT.d || u[0] < 0 || u[0] >= 1 || u[1] < 0 || u[1] >= 1) return -1;
    const v = HIT.d[Math.floor(u[1] * HIT.h) * HIT.w + Math.floor(u[0] * HIT.w)];
    return v >= 1 && v <= 5 ? v - 1 : -1;
  }
  /* raton: exacto sobre el frasco. Dedo: un poco de margen (un dedo tapa ~20 px) */
  function queFrasco(x, y, dedo) {
    const u = aFoto(x, y); let i = frascoEn(u);
    if (i >= 0 || !dedo) return i;
    for (const r of [10, 20]) for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4; i = frascoEn(aFoto(x + Math.cos(a) * r, y + Math.sin(a) * r));
      if (i >= 0) return i;
    }
    return -1;
  }

  /* ---------- camara ---------- */
  let aspecto = 1, vista = [0, 0, 1, 1];
  function cubrir(r) {
    const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2;
    let w, h;
    if (r[2] * IMG_A / r[3] > aspecto) { h = r[3]; w = h * aspecto / IMG_A; } else { w = r[2]; h = w * IMG_A / aspecto; }
    return [cx - w / 2, cy - h / 2, w, h];
  }
  function dentro(v) {
    const w = Math.min(v[2], 1), h = Math.min(v[3], 1);
    return [Math.min(Math.max(v[0], 0), 1 - w), Math.min(Math.max(v[1], 0), 1 - h), w, h];
  }
  const vistaGeneral = () => cubrir([0, 0, 1, 1]);
  /* Movil (1-nov): la ficha tapaba el precio grabado de los frascos de abajo (Alex). Se encuadra frasco + precio en
     el hueco entre la barra y la ficha. Para los de abajo la vista puede pasar del borde de la foto: alli se pinta la
     acera reflejada y oscura, que queda debajo de la ficha. Nunca se acerca mas que el primer plano de siempre. */
  const PRECIO_BAJO = .075;      // del pie del frasco al final de la cifra grabada, en alto de foto (medido)
  function vistaCerca(i) {
    const base = dentro(cubrir(Z[i].rect));
    if (!movil || !HIT.caja[i]) return base;
    const c = HIT.caja[i];
    const arriba = c[1] - .012, abajo = c[3] + PRECIO_BAJO;
    const yA = $('barra').getBoundingClientRect().bottom + 14;
    const fichaTop = $('ficha').hidden ? innerHeight * .58 : $('ficha').getBoundingClientRect().top;
    const yB = Math.max(fichaTop - 14, yA + 120);
    let h = Math.max(base[3], (abajo - arriba) * innerHeight / (yB - yA));
    let w = h * aspecto / IMG_A;
    if (w < (c[2] - c[0]) * 1.25) { w = (c[2] - c[0]) * 1.25; h = w * IMG_A / aspecto; }
    w = Math.min(w, 1); h = w * IMG_A / aspecto;
    const cx = (c[0] + c[2]) / 2;
    const y0 = arriba - yA / innerHeight * h - Math.max(0, (yB - yA) / innerHeight * h - (abajo - arriba)) / 2;
    const x0 = Math.min(Math.max(cx - w / 2, 0), 1 - w);
    return [x0, Math.max(y0, 0), w, h];
  }
  function mezclaVista(a, b, t) {               // zoom con punto fijo: no "patina" de lado
    const w = a[2] * Math.pow(b[2] / a[2], t), h = a[3] * Math.pow(b[3] / a[3], t);
    const k = Math.abs(a[2] - b[2]) > 1e-6 ? (a[2] - w) / (a[2] - b[2]) : t;
    const ca = [a[0] + a[2] / 2, a[1] + a[3] / 2], cb = [b[0] + b[2] / 2, b[1] + b[3] / 2];
    const cx = ca[0] + (cb[0] - ca[0]) * k, cy = ca[1] + (cb[1] - ca[1]) * k;
    return [cx - w / 2, cy - h / 2, w, h];
  }
  const suave = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function aFoto(x, y) { return [vista[0] + x / innerWidth * vista[2], vista[1] + y / innerHeight * vista[3]]; }
  function aPantalla(u, v) { return [(u - vista[0]) / vista[2] * innerWidth, (v - vista[1]) / vista[3] * innerHeight]; }

  /* ---------- estado ---------- */
  let modo = 'escaparate';         // escaparate | volando | cerca | volviendo
  let foco = -1, sel = -1;
  const luz = [1, 1, 1, 1, 1];
  let todas = 1, revela = 0, cercaA = 0, fuera = 0, vuelo = null, raton = null;
  const cercas = new Map();
  const pendientes = new Map();
  let prepararT = 0, cambio = true, listo = false, revelando = 0;
  const renovar = () => { cambio = true; };
  const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));

  function urlCerca(i) {
    if (movil) return MAXTEX >= 4096 ? `media/m-cerca-${i + 1}-2048.webp` : `media/m-cerca-${i + 1}.webp`;
    const px = innerWidth * Math.min(devicePixelRatio || 1, 2);
    const ancho = px > 3000 && MAXTEX >= 8192 ? 5504 : (px > 1500 && MAXTEX >= 4096 ? 3840 : 1920);
    return `media/cerca-${i + 1}-${ancho}.webp`;
  }
  function cargaCerca(i) {
    if (i < 0) return Promise.resolve();
    const url = urlCerca(i);
    if (cercas.has(url)) return Promise.resolve(cercas.get(url));
    if (!pendientes.has(url)) pendientes.set(url, (async () => {
      // Decodificar y subir una foto grande en plena camara producia un tiron.
      const tex = await texturaUrl(url);
      cercas.set(url, tex);
      // Una foto preparada y, como mucho, la seleccionada. No acumular cinco texturas 4K.
      for (const [k, t] of cercas) {
        if (k !== url && t !== T.cerca) { gl.deleteTexture(t); cercas.delete(k); }
      }
      renovar();
      return tex;
    })().finally(() => pendientes.delete(url)));
    return pendientes.get(url);
  }

  /* ---------- interfaz: ficha ---------- */
  const lista = $('lista');
  PRODUCTOS.forEach((p, i) => {
    const b = document.createElement('button'); b.type = 'button';
    b.textContent = `${p.nombre}, $${p.precio}`;
    b.addEventListener('focus', () => { if (modo === 'escaparate') ponerFoco(i); });
    b.addEventListener('click', () => abrir(i));
    lista.append(b);
  });
  $('pista').textContent = movil ? 'Tap a bottle to look closer' : 'Click a bottle to look closer';
  document.querySelectorAll('.ficha .fl').forEach((el, k) => el.style.setProperty('--d', `${0.08 + k * 0.055}s`));
  function ponerFoco(i) {
    if (i === foco) return;
    foco = i;
    document.body.classList.toggle('sobre', i >= 0 && !movil);
    renovar();
    clearTimeout(prepararT);
    if (i >= 0) prepararT = setTimeout(() => cargaCerca(i).catch(() => { }), 120);
  }
  let talla = 50;
  function pintarFicha(i) {
    const p = PRODUCTOS[i];
    $('fOjo').textContent = `N° 0${i + 1} · Eau de parfum`;
    $('fNombre').textContent = p.nombre;
    $('fNotas').innerHTML = ['Top', 'Heart', 'Base'].map((t, k) => `<dt>${t}</dt><dd>${p.notas[k]}</dd>`).join('');
    talla = 50;
    $('fTallas').innerHTML = [[50, p.precio], [100, p.p100]].map(([ml, pr]) =>
      `<button type="button" class="talla" role="radio" data-ml="${ml}" aria-checked="${ml === 50}"><span>${ml} ml</span><b>$${pr}</b></button>`).join('');
    pintarPrecio();
  }
  function pintarPrecio() { const p = PRODUCTOS[sel]; $('fPrecio').textContent = `$${talla === 50 ? p.precio : p.p100}`; }
  $('fTallas').addEventListener('click', (e) => {
    const b = e.target.closest('.talla'); if (!b) return;
    talla = +b.dataset.ml;
    $('fTallas').querySelectorAll('.talla').forEach((x) => x.setAttribute('aria-checked', x === b));
    pintarPrecio();
  });

  /* ---------- la bolsa ---------- */
  const bolsa = [];
  const bolsaBtn = $('bolsa');
  function pintarBolsa() {
    const n = bolsa.reduce((a, b) => a + b.n, 0);
    $('cuenta').textContent = n; bolsaBtn.classList.toggle('llena', n > 0);
    bolsaBtn.setAttribute('aria-label', `Bag, ${n} item${n === 1 ? '' : 's'}`);
    $('cajonLista').innerHTML = bolsa.map((b, k) => {
      const p = PRODUCTOS[b.i]; const pr = b.ml === 50 ? p.precio : p.p100;
      return `<li><img src="media/frasco-${b.i + 1}.webp${VER}" alt="">
      <div class="linea"><p>${p.nombre}</p><small>Eau de parfum · ${b.ml} ml</small>
        <div class="cant" role="group" aria-label="Quantity of ${p.nombre}">
          <button type="button" data-k="${k}" data-d="-1" aria-label="One less">−</button><span>${b.n}</span><button type="button" data-k="${k}" data-d="1" aria-label="One more">+</button>
        </div></div>
      <div class="dcha"><b>$${pr * b.n}</b><button type="button" class="quita" data-k="${k}">Remove</button></div></li>`;
    }).join('');
    $('cajonVacio').hidden = n > 0; $('cajonPie').hidden = n === 0;
    $('subtotal').textContent = `$${bolsa.reduce((a, b) => a + b.n * (b.ml === 50 ? PRODUCTOS[b.i].precio : PRODUCTOS[b.i].p100), 0)}`;
  }
  $('cajonLista').addEventListener('click', (e) => {
    const q = e.target.closest('.quita'), d = e.target.closest('[data-d]');
    if (q) {                                   // la linea se va con una salida corta, luego se quita
      const li = q.closest('li'), item = bolsa[+q.dataset.k];
      li.classList.add('sale'); setTimeout(() => {
        const k = bolsa.indexOf(item); if (k >= 0) bolsa.splice(k, 1); pintarBolsa();
      }, reducido.matches ? 0 : 260);
    } else if (d) {
      const b = bolsa[+d.dataset.k]; b.n += +d.dataset.d;
      if (b.n < 1) bolsa.splice(+d.dataset.k, 1);
      pintarBolsa();
    }
  });
  const cajon = $('cajon');
  function abrirCajon() {
    if (!cajon.hidden) return;
    ocultarAviso(); cajon.hidden = false; document.body.classList.add('quieto');
    requestAnimationFrame(() => requestAnimationFrame(() => cajon.classList.add('on')));
    setTimeout(() => cajon.querySelector('.x').focus({ preventScroll: true }), 50);
  }
  function cerrarCajon() {
    if (cajon.hidden) return;
    cajon.classList.remove('on');
    if (modo === 'escaparate') document.body.classList.remove('quieto');
    setTimeout(() => { if (!cajon.classList.contains('on')) cajon.hidden = true; }, 600);
    bolsaBtn.focus({ preventScroll: true });
  }
  bolsaBtn.addEventListener('click', abrirCajon);
  // menu del movil (en escritorio la capsula ya esta en el centro)
  const menuBtn = $('menuBtn');
  const menuOn = (v) => { document.body.classList.toggle('menu-on', v); menuBtn.setAttribute('aria-expanded', v); };
  menuBtn.addEventListener('click', (e) => { e.stopPropagation(); menuOn(!document.body.classList.contains('menu-on')); });
  $('menu').addEventListener('click', () => menuOn(false));
  addEventListener('pointerdown', (e) => { if (!e.target.closest('#menu,#menuBtn')) menuOn(false); }, true);
  cajon.addEventListener('click', (e) => { if (e.target.closest('[data-cierra]')) cerrarCajon(); });

  let avisoT = 0;
  function ocultarAviso() { clearTimeout(avisoT); $('aviso').classList.remove('on'); }
  function avisar(i, ml) {
    const a = $('aviso');
    a.innerHTML = `<img src="media/frasco-${i + 1}.webp${VER}" alt=""><p>${PRODUCTOS[i].nombre}<small>${ml} ml · added to your bag</small></p><button type="button">View bag</button>`;
    a.querySelector('button').addEventListener('click', abrirCajon);
    a.classList.add('on'); clearTimeout(avisoT); avisoT = setTimeout(ocultarAviso, 3200);
  }

  /* El frasco sale de la escena (su silueta real, en su sitio) y vuela en arco hasta la bolsa. */
  function vuelaABolsa(i) {
    const c = HIT.caja[i]; const destino = bolsaBtn.getBoundingClientRect();
    const fin = () => { bolsaBtn.classList.remove('salta'); void bolsaBtn.offsetWidth; bolsaBtn.classList.add('salta'); pintarBolsa(); };
    if (!c || reducido.matches) { fin(); return; }
    const [x0, y0] = aPantalla(c[0], c[1]), [x1, y1] = aPantalla(c[2], c[3]);
    const im = new Image(); im.src = `media/frasco-${i + 1}.webp${VER}`; im.className = 'vuela'; im.alt = '';
    const h = y1 - y0; im.style.height = `${h}px`; im.style.transformOrigin = '0 0';
    document.body.append(im);
    const tx = destino.left + destino.width / 2, ty = destino.top + destino.height / 2;
    const w = (x1 - x0), cx = x0 + w / 2, cy = y0 + h / 2;
    const s1 = 26 / h;                         // llega del tamano del icono
    const pico = Math.min(cy, ty) - Math.max(60, h * .25);
    const anim = im.animate([
      { transform: `translate(${x0}px,${y0}px) scale(1)`, opacity: 0, offset: 0 },
      { transform: `translate(${x0}px,${y0 - 14}px) scale(1.02)`, opacity: .96, offset: .14 },
      { transform: `translate(${cx + (tx - cx) * .55 - w * .3 / 2}px,${pico}px) scale(.3)`, opacity: .96, offset: .62 },
      { transform: `translate(${tx - w * s1 / 2}px,${ty - h * s1 / 2}px) scale(${s1})`, opacity: 0, offset: 1 },
    ], { duration: 980, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' });
    anim.onfinish = () => { im.remove(); fin(); };
  }
  let ocupado = false;
  $('fComprar').addEventListener('click', (e) => {
    if (ocupado || sel < 0) return;
    ocupado = true;
    const b = e.currentTarget, i = sel, ml = talla;
    const ya = bolsa.find((x) => x.i === i && x.ml === ml); if (ya) ya.n++; else bolsa.push({ i, ml, n: 1 });
    b.classList.add('hecho');
    vuelaABolsa(i);
    setTimeout(() => avisar(i, ml), 900);
    setTimeout(() => { b.classList.remove('hecho'); ocupado = false; }, 1900);
  });
  $('fVolver').addEventListener('click', () => cerrar());
  addEventListener('keydown', (e) => {
    document.body.dataset.teclado = '1';
    if (e.key === 'Escape') { if (!cajon.hidden) cerrarCajon(); else cerrar(); }
    if (modo !== 'escaparate' || !cajon.hidden) return;
    if (e.key === 'ArrowRight') ponerFoco(Math.min(foco + 1, 4));
    if (e.key === 'ArrowLeft') ponerFoco(foco < 0 ? 4 : Math.max(foco - 1, 0));
    if (e.key === 'Enter' && foco >= 0 && document.activeElement === document.body) abrir(foco);
  });

  /* ---------- abrir y cerrar ---------- */
  function abrir(i) {
    if (modo !== 'escaparate' || !Z) return;
    modo = 'volando'; sel = i; ponerFoco(i);
    if (scrollY > 2) scrollTo({ top: 0, behavior: reducido.matches ? 'auto' : 'smooth' });
    document.body.classList.add('volando', 'quieto'); $('ficha').hidden = false;
    pintarFicha(i);
    // La camara responde al toque. La foto nitida se prepara fuera del movimiento.
    clearTimeout(prepararT);
    T.cerca = cercas.get(urlCerca(i)) || null;
    const z = Z[i];
    gl.useProgram(prog);
    gl.uniform3f(U.uM0, z.M[0][0], z.M[0][1], z.M[0][2]);
    gl.uniform3f(U.uM1, z.M[1][0], z.M[1][1], z.M[1][2]);
    gl.uniform4f(U.uSub, z.sub[0], z.sub[1], z.sub[2], z.sub[3]);
    gl.uniform4f(U.uSel, z.limpia[0], z.limpia[1], z.limpia[2], z.limpia[3]);
    gl.uniform2f(U.uSelF, z.limpiaF[0], z.limpiaF[1]);
    revela = 0; cercaA = 1; revelando = T.cerca ? performance.now() : 0;
    const r = reducido.matches;
    vuelo = { t0: performance.now(), de: vista.slice(), a: vistaCerca(i), dur: r ? 250 : 1150, retraso: r ? 0 : 140, ida: true, ficha: false };
    renovar();
    cargaCerca(i).then((tex) => {
      if (sel !== i || (modo !== 'volando' && modo !== 'cerca')) return;
      if (T.cerca !== tex) { T.cerca = tex; revelando = performance.now(); renovar(); }
    }).catch(() => { });
  }
  function cerrar() {
    if (modo !== 'cerca' && modo !== 'volando') return;
    if (modo === 'volando' && !vuelo) return;
    modo = 'volviendo';
    document.body.classList.remove('cerca', 'ficha-on');
    const r = reducido.matches;
    vuelo = { t0: performance.now(), de: vista.slice(), a: vistaGeneral(), dur: r ? 250 : 1000, retraso: 0, ida: false };
  }

  /* ---------- raton y dedo (en toda la ventana: la escena esta debajo de la pagina) ---------- */
  const enEscena = (t) => t === cv || t === document.body || t === document.documentElement || !!(t.closest && t.closest('.escena'));
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const ok = enEscena(e.target);
    raton = ok ? [e.clientX, e.clientY] : null;
    if (modo === 'escaparate') ponerFoco(ok ? queFrasco(e.clientX, e.clientY, false) : -1);
  });
  document.addEventListener('pointerleave', () => { raton = null; if (modo === 'escaparate') ponerFoco(-1); });
  let toque = null;
  addEventListener('pointerdown', (e) => { toque = enEscena(e.target) && cajon.hidden ? { x: e.clientX, y: e.clientY } : null; });
  addEventListener('pointercancel', () => { toque = null; });
  addEventListener('pointerup', (e) => {
    const tq = toque; toque = null;
    if (!tq || Math.hypot(e.clientX - tq.x, e.clientY - tq.y) > 12) return;
    if (modo === 'escaparate') { const i = queFrasco(e.clientX, e.clientY, e.pointerType !== 'mouse'); if (i >= 0) abrir(i); }
    else if (modo === 'cerca') cerrar();
  });

  /* ---------- bajar hasta el pie ---------- */
  const sombra = $('sombra');
  function alBajar() {
    const k = Math.min(Math.max(scrollY / innerHeight, 0), 1);
    sombra.style.opacity = (k * 0.5).toFixed(3);
    document.body.classList.toggle('bajado', scrollY > 30);
    if (k > 0.05 && modo === 'escaparate' && foco >= 0 && !raton) ponerFoco(-1);
  }
  addEventListener('scroll', alBajar, { passive: true });

  /* ---------- tamano ---------- */
  function tam() {
    if (mqMovil.matches !== movil && modo === 'escaparate') { location.reload(); return; }   // giro: otra foto
    const d = Math.min(devicePixelRatio || 1, 3);
    cv.style.width = `${innerWidth}px`; cv.style.height = `${innerHeight}px`;
    const w = Math.round(innerWidth * d), h = Math.round(innerHeight * d);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, cv.width, cv.height);
    aspecto = innerWidth / innerHeight;
    if (!Z) return;
    if (modo === 'escaparate') vista = vistaGeneral();
    else if (modo === 'cerca') vista = vistaCerca(sel);
    renovar();
  }
  addEventListener('resize', tam);

  /* ---------- arranque ---------- */
  async function arrancar() {
    tam();
    const base = movil ? ['media/m-lit-1024.webp', 'media/m-dark-1024.webp'] : ['media/lit-2048.webp', 'media/dark-2048.webp'];
    const [zonas, l, d] = await Promise.all([fetch((movil ? 'zonas-movil.json' : 'zonas.json') + VER).then((r) => r.json()),
    imagen(base[0]), imagen(base[1]), cargarSiluetas()]);
    Z = prepararZonas(zonas);
    T.lit = textura(l); T.dark = textura(d);
    const zs = new Float32Array(20), fs = new Float32Array(10);
    Z.forEach((z, i) => { zs.set(z.luzR, i * 4); fs.set(z.luzF, i * 2); });
    gl.uniform4fv(U.uZ, zs); gl.uniform2fv(U.uF, fs);
    tam(); pintarBolsa(); alBajar();
    // Preparar tambien la ruta de subida por franjas antes de permitir el primer toque.
    // El primer texSubImage del navegador puede compilar su conversor: no hacerlo con la ficha abierta.
    if (GL2 && typeof createImageBitmap === 'function') {
      const mini = await createImageBitmap(l, 0, 0, 8, 8, { premultiplyAlpha: 'none' });
      const prueba = await texturaFluida(mini); mini.close(); gl.deleteTexture(prueba);
    }
    listo = true;
    // la foto grande, cuando llegue
    const grande = movil ? ['media/m-lit.webp', 'media/m-dark.webp']
      : (MAXTEX >= 4096 && innerWidth * Math.min(devicePixelRatio || 1, 3) > 1600
        ? (innerWidth * Math.min(devicePixelRatio || 1, 3) > 4096 && MAXTEX >= 8192
          ? ['media/lit-5504.webp', 'media/dark-5504.webp'] : ['media/lit-4096.webp', 'media/dark-4096.webp']) : null);
    if (grande && MAXTEX >= 4096) {
      (async () => {
        while (vuelo || document.hidden) await pausa(80);
        const lit = await texturaUrl(grande[0]), dark = await texturaUrl(grande[1]);
        gl.deleteTexture(T.lit); gl.deleteTexture(T.dark); T.lit = lit; T.dark = dark;
        renovar();
      })().catch(() => { });
    }
    // Solo bytes comprimidos en la cache HTTP: no cinco imagenes decodificadas en memoria.
    setTimeout(async () => {
      for (let i = 0; i < 5; i++) {
        try { const r = await fetch(urlCerca(i) + VER, { priority: 'low' }); await r.arrayBuffer(); } catch (_) { }
        await pausa(200);
      }
    }, 1800);
    // Un primer dibujo completo detras del velo. No anunciar lista una escena todavia vacia.
    cuadro(performance.now());
    requestAnimationFrame(() => document.body.classList.add('listo'));
  }

  let antes = performance.now();
  function cuadro(now) {
    requestAnimationFrame(cuadro);
    if (document.hidden || !listo) { antes = now; return; }
    const unicoObj = modo !== 'escaparate' ? sel : foco;
    const allObj = (modo === 'escaparate' && foco < 0) ? 1 : 0;
    const lucesCambian = Math.abs(todas - allObj) > .001 || luz.some((v, i) => Math.abs(v - (i === unicoObj ? 1 : 0)) > .001);
    const revelandoAhora = revelando > 0 && revela < 1;
    if (!cambio && !vuelo && !lucesCambian && !revelandoAhora) { antes = now; return; }
    cambio = false;
    const dt = Math.min((now - antes) / 1000, .05); antes = now;
    const ac = (x, obj, k) => x + (obj - x) * (1 - Math.exp(-dt * k));

    // luces: con un perfume elegido (raton encima o camara yendo hacia el) los otros se apagan
    const unico = modo !== 'escaparate' ? sel : foco;
    const todasObj = (modo === 'escaparate' && foco < 0) ? 1 : 0;
    todas = ac(todas, todasObj, todasObj ? 5 : 9);
    for (let i = 0; i < 5; i++) luz[i] = ac(luz[i], i === unico ? 1 : 0, 9);

    // camara
    if (vuelo) {
      const t = Math.min(Math.max((now - vuelo.t0 - vuelo.retraso) / vuelo.dur, 0), 1);
      vista = mezclaVista(vuelo.de, vuelo.a, suave(t));
      if (vuelo.ida) {
        fuera = suave(t);
        // la ficha entra a mitad del acercamiento, no al final
        if (!vuelo.ficha && t > .42) { vuelo.ficha = true; document.body.classList.add('ficha-on'); }
      } else {
        fuera = 1 - suave(t);
        cercaA = 1 - Math.min(Math.max((t - .55) / .45, 0), 1);
      }
      if (t >= 1 && now - vuelo.t0 > vuelo.retraso + vuelo.dur) {
        const ida = vuelo.ida; vuelo = null;
        if (ida) {
          modo = 'cerca'; document.body.classList.remove('volando'); document.body.classList.add('cerca', 'ficha-on');
          if (document.body.dataset.teclado) $('fComprar').focus({ preventScroll: true });
        } else {
          modo = 'escaparate'; cercaA = 0; revela = 0; revelando = 0; sel = -1;
          document.body.classList.remove('volando', 'quieto'); $('ficha').hidden = true;
          ponerFoco(!movil && raton ? queFrasco(raton[0], raton[1], false) : -1);
        }
      }
    }
    if (revelando && (modo === 'volando' || modo === 'cerca')) revela = Math.min((now - revelando) / (reducido.matches ? 150 : 600), 1);

    // pintar
    gl.useProgram(prog);
    const enlaza = (tex, u, n) => { gl.activeTexture(gl.TEXTURE0 + n); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(u, n); };
    enlaza(T.lit, U.uLit, 0); enlaza(T.dark, U.uDark, 1); enlaza(T.cerca || T.vacia, U.uClose, 2);
    gl.uniform4f(U.uView, vista[0], vista[1], vista[2], vista[3]);
    gl.uniform1fv(U.uW, luz);
    gl.uniform1f(U.uAll, todas); gl.uniform1f(U.uK, OSCURO_K);
    gl.uniform1f(U.uReveal, revela); gl.uniform1f(U.uCloseA, T.cerca ? cercaA : 0); gl.uniform1f(U.uOut, fuera);
    gl.uniform1f(U.uTime, now / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  addEventListener('visibilitychange', renovar);
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); listo = false; $('pista').textContent = 'Restoring the window…'; });
  cv.addEventListener('webglcontextrestored', () => location.reload());

  // si algo falla, nunca dejar la pantalla en negro: se quita el velo y se dice que paso
  function fallo(e) {
    console.error(e); document.body.classList.add('listo');
    $('pista').textContent = 'Something went wrong loading the window. Please reload.';
  }
  addEventListener('error', (e) => { if (!document.body.classList.contains('listo')) fallo(e.error || e.message); });
  setTimeout(() => { if (!document.body.classList.contains('listo')) fallo('timeout'); }, 15000);
  if (location.search.includes('prueba')) window.__pluie = {
    estado: () => ({ modo, sel, texturas: cercas.size, pendientes: pendientes.size, revela, lista: !!T.cerca, ancho: cv.width, alto: cv.height, decoder: !!decoder, decodeError }),
    centro: (i) => { const c = HIT.caja[i]; return aPantalla((c[0] + c[2]) / 2, (c[1] + c[3]) / 2); },
    precioY: () => sel >= 0 ? aPantalla(0, HIT.caja[sel][3] + PRECIO_BAJO)[1] : null,
    frascoArriba: () => sel >= 0 ? aPantalla(0, HIT.caja[sel][1])[1] : null
  };
  arrancar().catch(fallo);
})();
