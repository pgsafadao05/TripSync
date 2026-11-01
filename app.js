/* Tripsync: escapadas nos feriados do país de cada pessoa, combinadas com amigos. Dados no Supabase (login, perfil, grupos). */
(function () {
  const C = window.TRIPSYNC_CONFIG, F = window.Ferias, I = window.I18N, t = I.t;
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey);
  const $ = id => document.getElementById(id);
  const loc = () => I.lang === 'pt' ? 'pt-BR' : I.lang;
  const utcDate = d => new Date(d.slice(0, 10) + 'T00:00:00Z');
  const fmt = d => new Intl.DateTimeFormat(loc(), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(utcDate(d)).replace(/\./g, '');
  const nomeMes = m => new Intl.DateTimeFormat(loc(), { month: 'long', timeZone: 'UTC' }).format(Date.UTC(2027, m, 1));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const diaSeg = d => { const x = utcDate(d); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
  const msg = (id, texto, tipo) => { const el = $(id); el.textContent = texto || ''; el.className = 'msg' + (tipo ? ' ' + tipo : ''); };
  const iniciais = n => (n || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  const nDias = n => n + ' ' + (n === 1 ? t('dia1') : t('diaN'));

  // ---------- Países (nomes no idioma escolhido) ----------
  const PAIS_PT = Object.fromEntries(window.PAISES || []);
  let PAIS_NOME = PAIS_PT, LISTA_PAISES = window.PAISES || [];
  function nomesPaises() {
    let dn = null; try { dn = new Intl.DisplayNames([loc()], { type: 'region' }); } catch (e) {}
    PAIS_NOME = Object.fromEntries((window.PAISES || []).map(([a, n]) => { let x = null; try { x = I.lang !== 'pt' && dn ? dn.of(a) : null; } catch (e) {} return [a, x && x !== a ? x : n]; }));
    LISTA_PAISES = Object.entries(PAIS_NOME).sort((a, b) => a[1].localeCompare(b[1], loc()));
  }
  const bandeira = a2 => /^[A-Z]{2}$/.test(a2) && a2 !== 'XK' ? String.fromCodePoint(...[...a2].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : '🏳️';

  // ---------- Destinos (tempos a partir de Bruxelas) ----------
  const TODOS = [0,1,2,3,4,5,6,7,8,9,10,11], VERAO = [4,5,6,7,8], MEIO = [2,3,4,5,6,7,8,9,10];
  // nomes: pt|en|fr|nl|es (um só quando é igual em todos)
  const CIDADES = [
    ['Paris|Paris|Paris|Parijs|París','FR','1h20','trem',3,TODOS,''],['Amsterdã|Amsterdam|Amsterdam|Amsterdam|Ámsterdam','NL','2h','trem',3,TODOS,''],
    ['Londres|London|Londres|Londen|Londres','GB','2h','trem',3,TODOS,''],['Lisboa|Lisbon|Lisbonne|Lissabon|Lisboa','PT','2h45','voo',3,TODOS,'LIS'],
    ['Porto|Porto|Porto|Porto|Oporto','PT','2h20','voo',3,MEIO,'OPO'],['Barcelona|Barcelona|Barcelone|Barcelona|Barcelona','ES','2h','voo',3,MEIO,'BCN'],
    ['Madri|Madrid|Madrid|Madrid|Madrid','ES','2h15','voo',3,TODOS,'MAD'],['Sevilha|Seville|Séville|Sevilla|Sevilla','ES','2h40','voo',3,[0,1,2,3,4,9,10,11],'SVQ'],
    ['Málaga|Malaga|Malaga|Málaga|Málaga','ES','2h50','voo',3,TODOS,'AGP'],['Roma|Rome|Rome|Rome|Roma','IT','2h10','voo',3,MEIO,'FCO'],
    ['Veneza|Venice|Venise|Venetië|Venecia','IT','1h40','voo',3,MEIO,'VCE'],['Florença|Florence|Florence|Florence|Florencia','IT','1h50','voo',3,[3,4,5,8,9],'FLR'],
    ['Nápoles|Naples|Naples|Napels|Nápoles','IT','2h20','voo',4,[3,4,5,8,9],'NAP'],['Praga|Prague|Prague|Praag|Praga','CZ','1h20','voo',3,TODOS,'PRG'],
    ['Viena|Vienna|Vienne|Wenen|Viena','AT','1h40','voo',3,TODOS,'VIE'],['Budapeste|Budapest|Budapest|Boedapest|Budapest','HU','2h','voo',3,TODOS,'BUD'],
    ['Cracóvia|Krakow|Cracovie|Krakau|Cracovia','PL','2h','voo',3,[3,4,5,6,7,8,9,11],'KRK'],['Berlim|Berlin|Berlin|Berlijn|Berlín','DE','1h20','voo',3,TODOS,'BER'],
    ['Copenhague|Copenhagen|Copenhague|Kopenhagen|Copenhague','DK','1h25','voo',3,VERAO,'CPH'],['Estocolmo|Stockholm|Stockholm|Stockholm|Estocolmo','SE','2h','voo',3,VERAO,'ARN'],
    ['Edimburgo|Edinburgh|Édimbourg|Edinburgh|Edimburgo','GB','1h40','voo',3,VERAO,'EDI'],['Dublin|Dublin|Dublin|Dublin|Dublín','IE','1h30','voo',3,TODOS,'DUB'],
    ['Split','HR','2h20','voo',4,VERAO,'SPU'],['Dubrovnik','HR','2h40','voo',4,[4,5,6,7,8,9],'DBV'],['Zagreb','HR','1h50','voo',3,[3,4,5,8,9,11],'ZAG'],
    ['Atenas|Athens|Athènes|Athene|Atenas','GR','3h15','voo',4,[3,4,5,8,9],'ATH'],['Istambul|Istanbul|Istanbul|Istanbul|Estambul','TR','3h30','voo',4,[3,4,5,8,9,10],'IST'],
    ['Marrakech|Marrakesh|Marrakech|Marrakesh|Marrakech','MA','3h30','voo',4,[0,1,2,3,9,10,11],'RAK'],['Tenerife','ES','4h30','voo',5,[0,1,2,3,10,11],'TFS'],
    ['Nice|Nice|Nice|Nice|Niza','FR','1h40','voo',3,[3,4,5,6,7,8,9],'NCE'],['Valência|Valencia|Valence|Valencia|Valencia','ES','2h15','voo',3,MEIO,'VLC'],
    ['Palermo|Palermo|Palerme|Palermo|Palermo','IT','2h40','voo',4,[3,4,5,8,9],'PMO'],['Malta|Malta|Malte|Malta|Malta','MT','3h','voo',4,[3,4,5,8,9,10],'MLA'],
    ['Munique|Munich|Munich|München|Múnich','DE','1h15','voo',3,TODOS,'MUC'],['Liubliana|Ljubljana|Ljubljana|Ljubljana|Liubliana','SI','1h45','voo',3,MEIO,'LJU'],
    ['Riga','LV','2h30','voo',3,VERAO,'RIX'],['Tallinn','EE','2h40','voo',3,[4,5,6,7,8,11],'TLL'],['Bolonha|Bologna|Bologne|Bologna|Bolonia','IT','1h50','voo',3,MEIO,'BLQ'],
    ['Gdańsk','PL','1h55','voo',3,VERAO,'GDN'],['Funchal','PT','4h','voo',4,TODOS,'FNC'],
  ].map(([nomes, a2, tempo, modo, min, meses, iata]) => { const n = nomes.split('|'); return { nomes: n, a2, tempo, modo, min, meses, iata }; });
  const IDX = { pt: 0, en: 1, fr: 2, nl: 3, es: 4 };
  const nomeCidade = c => c.nomes[IDX[I.lang]] || c.nomes[0];
  const achaCidade = nome => { const n = norm(nome); return n ? CIDADES.find(c => c.nomes.some(x => norm(x) === n)) : null; };
  const mesmaCidade = (a, b) => { const ca = achaCidade(a), cb = achaCidade(b); return ca && cb ? ca === cb : norm(a) === norm(b); };

  // ---------- Estado ----------
  let user = null, perfil = null, planos = {}, planosGrupo = [], visitados = [], grupos = [], perfisGrupo = {}, grupoAberto = null;
  const hoje = new Date(), anoHoje = hoje.getFullYear(), ANOS = [anoHoje, anoHoje + 1, anoHoje + 2];
  let ano = anoHoje + 1, aba = 'escapadas', modoLogin = 'entrar';

  // ---------- Idioma ----------
  function opcoesIdioma(sel) { sel.innerHTML = I.LINGUAS.map(([c, n]) => '<option value="' + c + '"' + (c === I.lang ? ' selected' : '') + '>' + n + '</option>').join(''); }
  async function trocarIdioma(l, salvar) {
    if (l === I.lang) return;
    I.setLang(l); nomesPaises(); opcoesIdioma($('idiomaTopo'));
    if (!$('tela-login').hidden) mostrarLogin();
    if (perfil) {
      if (salvar) salvarPerfil({ idioma: l });
      opcoesPais($('cPais'), $('cPais').value); if (!$('passoPaises').hidden) desenharCadPaises();
      await prepararFeriados(); mapaFeito = false; mapaCadFeito = false; desenhar();
    }
  }
  $('idiomaTopo').addEventListener('change', e => trocarIdioma(e.target.value, true));

  // ---------- Login ----------
  function mostrarLogin(modo) {
    modoLogin = modo || modoLogin;
    $('tela-login').hidden = false; $('tela-app').hidden = true; $('tela-cadastro').hidden = true; $('btnPerfil').hidden = true;
    const k = { entrar: ['entrar', 'entrar', 'semConta'], criar: ['criarConta', 'criarConta', 'temConta'], 'nova-senha': ['novaSenha', 'salvarSenha', 'voltar'] }[modoLogin];
    $('loginTitulo').textContent = t(k[0]); $('lBotao').textContent = t(k[1]); $('trocaModo').textContent = t(k[2]);
    $('lEmail').closest('form').querySelector('label[for="lEmail"]').hidden = $('lEmail').hidden = modoLogin === 'nova-senha';
    $('lEmail').required = modoLogin !== 'nova-senha';
    $('lSenha').autocomplete = modoLogin === 'entrar' ? 'current-password' : 'new-password';
    $('esqueci').hidden = modoLogin !== 'entrar';
  }
  $('trocaModo').onclick = () => { msg('lMsg'); mostrarLogin(modoLogin === 'entrar' ? 'criar' : 'entrar'); };
  $('esqueci').onclick = async () => {
    const email = $('lEmail').value.trim();
    if (!email) { msg('lMsg', t('err.escrevaEmail'), 'erro'); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    msg('lMsg', error ? t('err.naoEnviou', { e: error.message }) : t('ok.linkSenha', { email }), error ? 'erro' : 'ok');
  };
  $('formLogin').addEventListener('submit', async ev => {
    ev.preventDefault();
    const email = $('lEmail').value.trim(), senha = $('lSenha').value;
    $('lBotao').disabled = true; msg('lMsg');
    try {
      if (modoLogin === 'entrar') {
        const { error } = await sb.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      } else if (modoLogin === 'criar') {
        const { data, error } = await sb.auth.signUp({ email, password: senha, options: { data: { idioma: I.lang }, emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        if (!data.session) msg('lMsg', t('ok.contaCriada', { email }), 'ok');
      } else {
        const { error } = await sb.auth.updateUser({ password: senha });
        if (error) throw error;
        msg('appMsg', t('ok.senhaTrocada'), 'ok'); modoLogin = 'entrar';
        const { data } = await sb.auth.getSession(); if (data.session) entrar(data.session);
      }
    } catch (e) {
      const m = /invalid login/i.test(e.message) ? t('err.loginErrado') : /already registered/i.test(e.message) ? t('err.jaTemConta') :
        /email not confirmed/i.test(e.message) ? t('err.confirme') : /password/i.test(e.message) ? t('err.senhaCurta') : e.message;
      msg('lMsg', m, 'erro');
    } finally { $('lBotao').disabled = false; }
  });
  $('sair').onclick = async () => { await sb.auth.signOut(); };

  sb.auth.onAuthStateChange((evento, session) => {
    if (evento === 'PASSWORD_RECOVERY') { mostrarLogin('nova-senha'); return; }
    if (session && session.user) { if (!user || user.id !== session.user.id) entrar(session); }
    else { user = null; perfil = null; mostrarLogin('entrar'); }
  });

  async function entrar(session) {
    user = session.user;
    $('tela-login').hidden = true;
    try { const a = +localStorage.getItem('tripsync:ano'); if (ANOS.includes(a)) ano = a; } catch (e) {}
    await carregarTudo();
    if (perfil.idioma && perfil.idioma !== I.lang) await trocarIdioma(perfil.idioma, false);
    else if (!perfil.idioma) salvarPerfil({ idioma: I.lang });
    if (!perfil.cadastro_completo) return mostrarCadastro();
    await abrirApp();
  }
  async function abrirApp() {
    $('tela-cadastro').hidden = true; $('tela-app').hidden = false; $('btnPerfil').hidden = false;
    await prepararFeriados();
    irPara();
  }

  // ---------- Feriados do país da pessoa ----------
  // Na Bélgica (e em Luxemburgo) feriado que cai no fim de semana vira um dia de folga a mais.
  const RECUPERA = new Set(['BE', 'LU']);
  const ferCache = {};
  const paisAtual = () => (perfil && perfil.pais) || 'BE';
  async function prepararFeriados() {
    const pais = paisAtual();
    if (!ferCache[pais]) {
      try { const r = await fetch('feriados/' + pais + '.json'); ferCache[pais] = r.ok ? await r.json() : null; }
      catch (e) { ferCache[pais] = null; }
    }
    const d = ferCache[pais];
    if (!d) { F.usarFeriados(y => pais === 'BE' ? F.feriadosBelgica(y) : []); return; }
    const nomes = d.nomes[I.lang] || {};
    F.usarFeriados(y => (d.anos[y] || []).map(([data, id]) => [data, nomes[id] || id, id]));
    // "Não me interessa" antigo guardava o nome em português: troca pela chave estável
    const pt = d.nomes.pt || {}, porNome = Object.fromEntries(Object.entries(pt).map(([id, n]) => [n, id]));
    const oc = perfil.feriados_ocultos || [], novo = oc.map(x => porNome[x] || x);
    if (novo.some((x, i) => x !== oc[i])) salvarPerfil({ feriados_ocultos: [...new Set(novo)] });
  }
  const ZONAS = { 'Europe/Brussels': 'BE', 'Europe/Lisbon': 'PT', 'Atlantic/Madeira': 'PT', 'Atlantic/Azores': 'PT', 'America/Sao_Paulo': 'BR', 'America/Fortaleza': 'BR',
    'America/Recife': 'BR', 'America/Bahia': 'BR', 'America/Manaus': 'BR', 'America/Belem': 'BR', 'Europe/Paris': 'FR', 'Europe/Amsterdam': 'NL', 'Europe/Luxembourg': 'LU',
    'Europe/Berlin': 'DE', 'Europe/Madrid': 'ES', 'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Rome': 'IT', 'Europe/Zurich': 'CH', 'Europe/Vienna': 'AT' };
  function paisProvavel() { try { return ZONAS[Intl.DateTimeFormat().resolvedOptions().timeZone] || ''; } catch (e) { return ''; } }
  function opcoesPais(sel, atual) {
    sel.innerHTML = '<option value="">' + esc(t('escolhaPais')) + '</option>' +
      LISTA_PAISES.map(([a, n]) => '<option value="' + a + '"' + (a === atual ? ' selected' : '') + '>' + bandeira(a) + ' ' + esc(n) + '</option>').join('');
  }
  const deBruxelas = () => !perfil.cidade_base || ['bruxelas', 'brussels', 'bruxelles', 'brussel', 'bruselas'].includes(norm(perfil.cidade_base));

  // ---------- Cadastro em 2 passos (primeira entrada) ----------
  let cadPaises = new Set(), mapaCadFeito = false;
  function mostrarCadastro() {
    $('tela-cadastro').hidden = false; $('tela-app').hidden = true; $('btnPerfil').hidden = true;
    $('formCadastro').hidden = false; $('passoPaises').hidden = true;
    $('cNome').value = perfil.nome || ''; $('cSobrenome').value = perfil.sobrenome || ''; $('cNasc').value = perfil.data_nascimento || '';
    $('cCidade').value = perfil.cidade_base || ''; $('cDias').value = perfil.dias_ferias ?? ''; $('cTel').value = perfil.telefone || '';
    $('cNasc').max = new Date().toISOString().slice(0, 10);
    opcoesPais($('cPais'), perfil.pais || paisProvavel());
    cadPaises = new Set(perfil.paises_visitados || []);
    window.scrollTo(0, 0);
  }
  $('formCadastro').addEventListener('submit', async ev => {
    ev.preventDefault();
    const nasc = $('cNasc').value, idade = nasc ? (Date.now() - Date.parse(nasc)) / 3.15576e10 : 0;
    if (idade < 10 || idade > 110) return msg('cMsg', t('err.nasc'), 'erro');
    const dias = +$('cDias').value;
    if (!(dias >= 0 && dias <= 60)) return msg('cMsg', t('err.dias'), 'erro');
    msg('cMsg');
    const ok = await salvarPerfil({ nome: $('cNome').value.trim(), sobrenome: $('cSobrenome').value.trim(), data_nascimento: nasc, pais: $('cPais').value,
      cidade_base: $('cCidade').value.trim(), dias_ferias: Math.round(dias), telefone: $('cTel').value.trim() || null });
    if (!ok) return msg('cMsg', t('err.salvar'), 'erro');
    if (perfil.pais) cadPaises.add(perfil.pais); // o país onde mora já entra colorido no mapa
    $('formCadastro').hidden = true; $('passoPaises').hidden = false; desenharCadPaises(); window.scrollTo(0, 0);
  });
  function desenharMapa(svg) {
    const M = window.MAPA; if (!M) return;
    svg.setAttribute('viewBox', '0 0 ' + M.w + ' ' + M.h);
    svg.innerHTML = Object.entries(M.paises).map(([a, d]) => '<path class="p" data-a2="' + a + '" d="' + d + '"><title>' + esc(PAIS_NOME[a] || a) + '</title></path>').join('');
  }
  function desenharCadPaises() {
    if (!mapaCadFeito) { desenharMapa($('mapaCad')); mapaCadFeito = true; }
    $('mapaCad').querySelectorAll('path.p').forEach(p => p.classList.toggle('foi', cadPaises.has(p.dataset.a2)));
    $('nCad').textContent = cadPaises.size;
    const q = norm($('buscaCad').value);
    $('listaCad').innerHTML = LISTA_PAISES.filter(([a, n]) => !q || norm(n).includes(q))
      .map(([a, n]) => '<button type="button" class="chip" data-cad="' + a + '" aria-pressed="' + cadPaises.has(a) + '">' + bandeira(a) + ' ' + esc(n) + '</button>').join('')
      || '<span class="sub">' + esc(t('nenhumPais')) + '</span>';
  }
  const togCad = a => { cadPaises.has(a) ? cadPaises.delete(a) : cadPaises.add(a); desenharCadPaises(); };
  $('listaCad').addEventListener('click', ev => { const b = ev.target.closest('[data-cad]'); if (b) togCad(b.dataset.cad); });
  $('mapaCad').addEventListener('click', ev => { const p = ev.target.closest('path.p'); if (p) togCad(p.dataset.a2); });
  $('buscaCad').addEventListener('input', desenharCadPaises);
  $('voltarCad').onclick = () => { $('passoPaises').hidden = true; $('formCadastro').hidden = false; };
  $('fimCad').onclick = async () => {
    $('fimCad').disabled = true;
    const ok = await salvarPerfil({ paises_visitados: [...cadPaises], cadastro_completo: true });
    $('fimCad').disabled = false;
    if (!ok) return msg('cMsg2', t('err.salvar'), 'erro');
    location.hash = 'escapadas'; await abrirApp();
  };

  // ---------- Dados ----------
  async function carregarTudo() {
    const [p, v, g] = await Promise.all([
      sb.from('profiles').select('*').eq('id', user.id).single(),
      sb.from('visitados').select('*').eq('user_id', user.id).order('created_at'),
      sb.from('grupos').select('*').order('created_at'),
    ]);
    if (p.error) msg('appMsg', t('err.perfil', { e: p.error.message }), 'erro');
    perfil = p.data || { id: user.id, feriados_ocultos: [], paises_visitados: [] };
    visitados = v.data || []; grupos = g.data || [];
    await carregarPlanos();
    await carregarPerfisGrupo();
  }
  async function carregarPlanos() {
    const { data, error } = await sb.from('planos').select('*').eq('ano', ano);
    if (error) { msg('appMsg', t('err.viagens', { e: error.message }), 'erro'); return; }
    planos = {}; planosGrupo = data || [];
    planosGrupo.filter(r => r.user_id === user.id).forEach(r => { planos[r.trip_id] = r; });
  }
  async function carregarPerfisGrupo() {
    const { data } = await sb.from('profiles').select('id,nome,sobrenome,foto_url');
    perfisGrupo = Object.fromEntries((data || []).map(p => [p.id, p]));
  }
  async function salvarPlano(tripId, patch) {
    const atual = planos[tripId] || { user_id: user.id, ano, trip_id: tripId };
    const novo = Object.assign({}, atual, patch);
    planos[tripId] = novo;
    if (todosPlanos) { todosPlanos = todosPlanos.filter(r => !(r.trip_id === tripId && r.ano === novo.ano)); todosPlanos.push(novo); }
    desenhar();
    const { user_id, ano: a, trip_id, status, duracao, cidade, iata, inicio, fim } = novo;
    const { error } = await sb.from('planos').upsert({ user_id, ano: a, trip_id, status: status || null, duracao: duracao || null, cidade: cidade || null, iata: iata || null, inicio: inicio || null, fim: fim || null });
    if (error) msg('appMsg', t('err.salvarE', { e: error.message }), 'erro');
    else { const i = planosGrupo.findIndex(r => r.user_id === user.id && r.trip_id === tripId); if (i >= 0) planosGrupo[i] = novo; else planosGrupo.push(novo); }
  }
  async function apagarPlano(tripId) {
    delete planos[tripId]; if (todosPlanos) todosPlanos = todosPlanos.filter(r => r.trip_id !== tripId); planosGrupo = planosGrupo.filter(r => !(r.user_id === user.id && r.trip_id === tripId)); desenhar();
    gastos = gastos.filter(g => g.trip_id !== tripId);
    await sb.from('gastos').delete().eq('user_id', user.id).eq('trip_id', tripId);
    const { error } = await sb.from('planos').delete().eq('user_id', user.id).eq('trip_id', tripId);
    if (error) msg('appMsg', t('err.salvarE', { e: error.message }), 'erro');
  }
  async function salvarPerfil(patch) {
    Object.assign(perfil, patch);
    const { error } = await sb.from('profiles').update(patch).eq('id', user.id);
    if (error) msg('appMsg', t('err.salvarE', { e: error.message }), 'erro');
    return !error;
  }

  // ---------- Navegação ----------
  function irPara() { const h = location.hash.slice(1); aba = ['escapadas', 'viagens', 'jafui', 'grupos', 'perfil'].includes(h) ? h : 'escapadas'; desenhar(); }
  window.addEventListener('hashchange', () => { if (user && perfil && perfil.cadastro_completo) irPara(); });
  $('btnPerfil').onclick = () => { location.hash = 'perfil'; };

  function desenhar() {
    if (!user || !perfil || $('tela-app').hidden) return;
    document.querySelectorAll('.abas a').forEach(a => a.setAttribute('aria-current', a.dataset.aba === aba ? 'page' : 'false'));
    ['escapadas', 'viagens', 'jafui', 'grupos', 'perfil'].forEach(k => { $('aba-' + k).hidden = k !== aba; });
    const b = $('btnPerfil');
    if (perfil.foto_url) { b.style.backgroundImage = 'url("' + perfil.foto_url + '")'; b.textContent = ''; } else { b.style.backgroundImage = ''; b.textContent = iniciais(perfil.nome); }
    if (aba === 'escapadas') desenharEscapadas();
    if (aba === 'viagens') desenharViagens();
    if (aba === 'jafui') desenharJaFui();
    if (aba === 'grupos') desenharGrupos();
    if (aba === 'perfil') desenharPerfil();
  }

  // ---------- Escapadas ----------
  function paisesVisitados() {
    const s = new Set(perfil.paises_visitados || []);
    visitados.forEach(v => v.a2 && s.add(v.a2));
    return s;
  }
  function ideias(mes, L, semente) {
    const pv = paisesVisitados();
    const ok = CIDADES.filter(c => c.meses.includes(mes) && c.min <= L && !visitados.some(v => mesmaCidade(v.cidade, c.nomes[0])));
    const novos = ok.filter(c => !pv.has(c.a2)), base = novos.length >= 3 ? novos : ok, n = base.length, out = [];
    base.sort((a, b) => L >= 4 ? b.min - a.min : a.min - b.min);
    for (let k = 0; k < Math.min(4, n); k++) out.push(base[(semente * 3 + k * Math.max(1, Math.floor(n / 4))) % n]);
    return [...new Set(out)];
  }
  // ---------- Viagens livres (a pessoa escolhe a data e quantos dias) ----------
  const ehLivre = id => String(id).startsWith('livre-');
  const somaDias = (d, n) => { const x = utcDate(d); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  function janelaLivre(inicio, n) {
    const y = +inicio.slice(0, 4), fer = new Set([...F.feriados(y - 1), ...F.feriados(y), ...F.feriados(y + 1)].map(h => h.data));
    const tirar = []; let feriados = 0;
    for (let i = 0; i < n; i++) {
      const d = somaDias(inicio, i), w = utcDate(d).getUTCDay();
      if (w === 0 || w === 6) continue;
      if (fer.has(d)) feriados++; else tirar.push(d);
    }
    return { inicio, fim: somaDias(inicio, n - 1), total: n, custo: tirar.length, tirar, feriados };
  }
  // Dentro do mês, a data de início que gasta menos dias de férias para n dias de viagem
  function melhorInicio(y, m, n) {
    let best = null;
    for (let d = 1; d <= new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); d++) {
      const ini = new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
      if (ini < hojeISO) continue;
      const j = janelaLivre(ini, n);
      // empate: prefere começar sexta ou sábado (fim de semana inteiro no começo)
      const bom = [5, 6].includes(utcDate(ini).getUTCDay());
      if (!best || j.custo < best.custo || (j.custo === best.custo && bom && !best.bom)) best = Object.assign(j, { bom });
    }
    return best;
  }
  const hojeISO = new Date().toISOString().slice(0, 10);
  const livresMinhas = () => Object.values(planos).filter(p => ehLivre(p.trip_id) && p.inicio);
  let editando = null; // { id, mes, inicio, dias }
  function gasto() {
    const fer = F.cityTrips(ano).reduce((s, x) => { const p = planos[x.id]; return s + (p && p.status === 'vou' ? x.opcoes[p.duracao || x.padrao].custo : 0); }, 0);
    return fer + livresMinhas().reduce((s, p) => s + janelaLivre(p.inicio, p.duracao).custo, 0);
  }
  // Código de aeroporto/cidade para os buscadores (Skyscanner aceita códigos de cidade)
  const AEROPORTOS = { bruxelas: 'BRU', brussels: 'BRU', bruxelles: 'BRU', brussel: 'BRU', bruselas: 'BRU', antuerpia: 'BRU', antwerpen: 'BRU', anvers: 'BRU', gent: 'BRU', gante: 'BRU',
    charleroi: 'CRL', liege: 'LGG', luik: 'LGG', lisboa: 'LIS', lisbon: 'LIS', porto: 'OPO', paris: 'PARI', londres: 'LOND', london: 'LOND', amsterda: 'AMS', amsterdam: 'AMS',
    eindhoven: 'EIN', roterda: 'RTM', rotterdam: 'RTM', madri: 'MAD', madrid: 'MAD', barcelona: 'BCN', 'sao paulo': 'SAO', 'rio de janeiro': 'RIOA', luxemburgo: 'LUX', luxembourg: 'LUX',
    genebra: 'GVA', geneve: 'GVA', zurique: 'ZRH', zurich: 'ZRH', berlim: 'BER', berlin: 'BER', roma: 'ROME', rome: 'ROME', milao: 'MILA', milan: 'MILA', dublin: 'DUB',
    colonia: 'CGN', koln: 'CGN', dusseldorf: 'DUS', frankfurt: 'FRA', munique: 'MUC', munich: 'MUC', lyon: 'LYS', marselha: 'MRS', marseille: 'MRS', nice: 'NCE', faro: 'FAO' };
  const codigoOrigem = () => { const c = (perfil.cidade_base || '').trim(); return /^[A-Za-z]{3,4}$/.test(c) ? c.toUpperCase() : (AEROPORTOS[norm(c)] || (deBruxelas() ? 'BRU' : '')); };
  const yymmdd = d => d.slice(2).replace(/-/g, '');
  // Sem cidade: onde está mais barato voar nessas datas
  function linkQualquerLugar(o) {
    const org = codigoOrigem(); if (!org) return '';
    return '<a href="https://www.skyscanner.net/transport/flights/' + org.toLowerCase() + '/anywhere/' + yymmdd(o.inicio) + '/' + yymmdd(o.fim) + '/?rtn=1" target="_blank" rel="noopener">' + t('link.qualquer') + '</a>';
  }
  function linksViagem(rotulo, o, p) {
    const cid = achaCidade(p.cidade);
    const iata = (p.iata || (cid && cid.iata) || '').toUpperCase(), de = perfil.cidade_base || 'Brussels', org = codigoOrigem();
    const voos = org && iata ? 'https://www.skyscanner.net/transport/flights/' + org.toLowerCase() + '/' + iata.toLowerCase() + '/' + yymmdd(o.inicio) + '/' + yymmdd(o.fim) + '/?rtn=1&sortby=price'
      : 'https://www.google.com/travel/flights?hl=' + loc() + '&q=' + encodeURIComponent('cheapest flights from ' + de + ' to ' + (iata || p.cidade) + ' ' + o.inicio + ' to ' + o.fim);
    const hotel = 'https://www.booking.com/searchresults.html?ss=' + encodeURIComponent(p.cidade) + '&checkin=' + o.inicio + '&checkout=' + o.fim + '&group_adults=1&no_rooms=1&nflt=ht_id%3D204&order=price';
    const agenda = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(t('agenda.titulo', { c: p.cidade })) +
      '&dates=' + o.inicio.replace(/-/g, '') + '/' + diaSeg(o.fim).replace(/-/g, '') + '&location=' + encodeURIComponent(p.cidade) +
      '&details=' + encodeURIComponent(t('agenda.det', { n: o.total, f: rotulo, d: o.tirar.map(fmt).join(', ') || t('nenhumDia') }));
    const trem = cid && cid.modo === 'trem' && deBruxelas();
    return '<div class="acoes esq links">' + (trem ? '<a href="https://www.eurostar.com" target="_blank" rel="noopener">' + t('link.trens') + '</a>' : '<a href="' + voos + '" target="_blank" rel="noopener">' + t('link.baratos') + '</a>') +
      '<a href="' + hotel + '" target="_blank" rel="noopener">' + t('link.hoteisBaratos') + '</a><a href="' + agenda + '" target="_blank" rel="noopener">' + t('link.agenda') + '</a></div>';
  }
  function amigosNaTrip(tripId) {
    return planosGrupo.filter(r => r.trip_id === tripId && r.user_id !== user.id && r.status === 'vou')
      .map(r => '<span class="chip vou">' + esc(t('vaiNome', { n: (perfisGrupo[r.user_id] || {}).nome || t('amigo') })) + (r.cidade ? ' · ' + esc(r.cidade) : '') + '</span>').join('');
  }
  function desenharEscapadas() {
    $('anos').innerHTML = ANOS.map(y => '<button type="button" data-ano="' + y + '" aria-pressed="' + (y === ano) + '">' + y + '</button>').join('');
    const pais = paisAtual(), todosFer = F.feriados(ano), trips = F.cityTrips(ano), dias = perfil.dias_ferias ?? 0;
    const fds = RECUPERA.has(pais) ? todosFer.filter(h => h.fimDeSemana) : [], ORC = dias + fds.length, g = gasto();
    $('restam').textContent = ORC - g; $('restam').style.color = g > ORC ? 'var(--nao)' : '';
    $('saldoTxt').textContent = t('saldo.livres') + ' · ' + t('saldo.ferias', { n: dias }) + (fds.length ? ' ' + (fds.length > 1 ? t('saldo.fdsN', { n: fds.length }) : t('saldo.fds1')) : '') +
      ' · ' + t('saldo.pais', { pais: PAIS_NOME[pais] || pais });
    const ocultos = new Set(perfil.feriados_ocultos || []);
    const sempre = x => ocultos.has(x.chave) || ocultos.has(x.feriado);
    const escondida = x => sempre(x) || (planos[x.id] && planos[x.id].status === 'agora-nao');
    let html = todosFer.length ? '' : '<div class="aviso">' + esc(t('aviso.semFeriados', { pais: PAIS_NOME[pais] || pais, ano })) + '</div>';
    for (let m = 0; m < 12; m++) {
      if (ano === anoHoje && m < hoje.getMonth()) continue;
      const doMes = trips.filter(x => x.mes === m), vis = doMes.filter(x => !escondida(x));
      const livres = livresMinhas().filter(p => +p.inicio.slice(5, 7) - 1 === m && +p.inicio.slice(0, 4) === ano).sort((a, b) => a.inicio.localeCompare(b.inicio));
      const nv = vis.length + livres.length;
      html += '<section class="mes"><h2>' + esc(nomeMes(m)) + ' <small>' + esc(nv ? (nv > 1 ? t('mes.nN', { n: nv }) : t('mes.n1')) : doMes.length ? t('mes.escondida') : t('mes.sem')) + '</small></h2>';
      vis.forEach((x, idx) => {
        const p = planos[x.id] || {}, L = p.duracao || x.padrao, o = x.opcoes[L], vou = p.status === 'vou';
        const durs = [3, 4, 5].concat(L > 5 ? [L] : []), cid = ideias(m, L, m + idx), am = amigosNaTrip(x.id);
        html += '<article class="trip' + (vou ? ' vou' : '') + '" data-id="' + x.id + '">' +
          '<div class="linha1"><div><div class="datas">' + esc(fmt(o.inicio)) + ' → ' + esc(fmt(o.fim)) + '</div><div class="sub">' + esc(x.feriado) + ' · ' + esc(t('trip.dias', { n: o.total })) + '</div></div>' +
          '<div class="custo"><b' + (o.custo === 0 ? ' class="zero"' : '') + '>' + esc(nDias(o.custo)) + '</b><span class="sub">' + esc(t('deFerias')) + '</span></div></div>' +
          '<div class="sub">' + esc(o.tirar.length ? t('pedirFolga', { d: o.tirar.map(fmt).join(', ') }) : t('semPedir')) + '</div>' +
          '<div class="duracao">' + durs.map(d => '<button type="button" data-dur="' + d + '" aria-pressed="' + (d === L) + '">' + esc(t('durBtn', { d, c: x.opcoes[d].custo })) + '</button>').join('') +
            (L < 16 ? '<button type="button" data-dur="' + Math.max(6, L + 1) + '" aria-label="' + esc(t('aria.esticar')) + '"><b>+</b></button>' : '') + '</div>' +
          (am ? '<div class="chips">' + am + '</div>' : '') +
          '<div class="form"><label for="c-' + x.id + '">' + esc(t('cidadeQuero')) + '</label><input type="text" id="c-' + x.id + '" data-cidade value="' + esc(p.cidade || '') + '" placeholder="' + esc(t('escrevaCidade')) + '" autocomplete="off">' +
            (cid.length ? '<div class="chips"><span class="sub">' + esc(t('ideias')) + '</span>' + cid.map(c => '<button type="button" class="chip" data-ideia="' + esc(nomeCidade(c)) + '">' + bandeira(c.a2) + ' ' + esc(nomeCidade(c)) +
              (deBruxelas() ? ' <span class="sub">' + esc(t(c.modo, { t: c.tempo })) + '</span>' : '') + '</button>').join('') + '</div>' : '') + '</div>' +
          '<div class="acoes esq"><button type="button" class="ir" data-acao="vou">' + esc(vou ? t('vouViajar') : t('querIr')) + '</button>' +
            (vou ? '' : '<button type="button" class="leve" data-acao="agora-nao">' + esc(t('agoraNao')) + '</button><button type="button" class="leve" data-acao="ocultar">' + esc(t('naoInteressa')) + '</button>') + '</div>' +
          (vou && p.cidade ? linksViagem(x.feriado, o, p) : vou ? '<div class="sub">' + esc(t('precisaCidade')) + '</div><div class="acoes esq links">' + linkQualquerLugar(o) + '</div>' : '') +
          '</article>';
      });
      doMes.filter(escondida).forEach(x => {
        const s = sempre(x), o = x.opcoes[(planos[x.id] || {}).duracao || x.padrao];
        html += '<div class="oculta"><span>' + esc(x.feriado) + ' · ' + esc(fmt(o.inicio)) + ' → ' + esc(fmt(o.fim)) + ' <small>(' + esc(s ? t('oculta.nao') : t('oculta.agora')) + ')</small></span>' +
          '<button type="button" class="leve" ' + (s ? 'data-volta-sempre="' + esc(x.chave) + '" data-volta-nome="' + esc(x.feriado) + '"' : 'data-volta="' + x.id + '"') + '>' + esc(t('mostrar')) + '</button></div>';
      });
      livres.forEach(p => { html += editando && editando.id === p.trip_id ? formLivre(m) : cartaoLivre(p); });
      if (editando && !editando.id && editando.mes === m) html += formLivre(m);
      else if (!(editando && editando.mes === m)) html += '<button type="button" class="criar" data-criar="' + m + '">' + esc(t('criarViagem', { mes: nomeMes(m) })) + '</button>';
      html += '</section>';
    }
    $('lista').innerHTML = html;
  }
  function cartaoLivre(p) {
    const o = janelaLivre(p.inicio, p.duracao);
    return '<article class="trip vou livre" data-livre="' + esc(p.trip_id) + '">' +
      '<div class="linha1"><div><div class="rotulo">' + esc(t('livre.rotulo')) + '</div><div class="datas">' + esc(fmt(o.inicio)) + ' → ' + esc(fmt(o.fim)) + '</div><div class="sub">' + esc(t('trip.dias', { n: o.total })) + '</div></div>' +
      '<div class="custo"><b' + (o.custo === 0 ? ' class="zero"' : '') + '>' + esc(nDias(o.custo)) + '</b><span class="sub">' + esc(t('deFerias')) + '</span></div></div>' +
      '<div class="sub">' + esc(o.tirar.length ? t('pedirFolga', { d: o.tirar.length > 6 ? fmt(o.tirar[0]) + ' … ' + fmt(o.tirar[o.tirar.length - 1]) + ' (' + o.tirar.length + ')' : o.tirar.map(fmt).join(', ') }) : t('semPedir')) + '</div>' +
      '<div class="form"><label for="c-' + esc(p.trip_id) + '">' + esc(t('cidadeQuero')) + '</label><input type="text" id="c-' + esc(p.trip_id) + '" data-cidade-livre value="' + esc(p.cidade || '') + '" placeholder="' + esc(t('escrevaCidade')) + '" autocomplete="off"></div>' +
      (p.cidade ? linksViagem(t('livre.rotulo'), o, p) : '<div class="acoes esq links">' + linkQualquerLugar(o) + '</div>') +
      '<div class="acoes esq"><button type="button" class="leve" data-editar-livre>' + esc(t('editar')) + '</button><button type="button" class="leve" data-apagar-livre>' + esc(t('apagar')) + '</button></div></article>';
  }
  function formLivre(m) {
    const e = editando, o = janelaLivre(e.inicio, e.dias);
    return '<div class="trip form-livre" data-form-livre>' +
      '<div class="dupla"><div class="form"><label for="fl-ini">' + esc(t('livre.inicio')) + '</label><input type="date" id="fl-ini" value="' + e.inicio + '" min="' + hojeISO + '"></div>' +
      '<div class="form"><label for="fl-dias">' + esc(t('livre.dias')) + '</label><input type="number" id="fl-dias" min="1" max="60" value="' + e.dias + '" inputmode="numeric"></div></div>' +
      '<button type="button" class="leve" data-melhor>' + esc(t('livre.melhor')) + '</button>' +
      '<div class="linha1"><div><div class="datas">' + esc(fmt(o.inicio)) + ' → ' + esc(fmt(o.fim)) + '</div><div class="sub">' + esc(t('trip.dias', { n: o.total })) + '</div></div>' +
      '<div class="custo"><b' + (o.custo === 0 ? ' class="zero"' : '') + '>' + esc(nDias(o.custo)) + '</b><span class="sub">' + esc(t('deFerias')) + '</span></div></div>' +
      '<div class="acoes esq"><button type="button" class="ir" data-salvar-livre>' + esc(t('livre.salvar')) + '</button><button type="button" class="leve" data-cancelar-livre>' + esc(t('cancelar')) + '</button></div></div>';
  }
  $('anos').addEventListener('click', async ev => {
    const b = ev.target.closest('[data-ano]'); if (!b) return;
    ano = +b.dataset.ano; try { localStorage.setItem('tripsync:ano', ano); } catch (e) {}
    await carregarPlanos(); desenhar();
  });
  $('lista').addEventListener('click', ev => {
    const criar = ev.target.closest('[data-criar]');
    if (criar) { const m = +criar.dataset.criar, b = melhorInicio(ano, m, 5) || janelaLivre(new Date(Date.UTC(ano, m, 1)).toISOString().slice(0, 10), 5); editando = { id: null, mes: m, inicio: b.inicio, dias: 5 }; return desenhar(); }
    if (ev.target.closest('[data-cancelar-livre]')) { editando = null; return desenhar(); }
    if (ev.target.closest('[data-melhor]')) { const ini = editando.inicio; const b = melhorInicio(+ini.slice(0, 4), +ini.slice(5, 7) - 1, editando.dias); if (b) editando.inicio = b.inicio; return desenhar(); }
    if (ev.target.closest('[data-salvar-livre]')) {
      const e = editando, o = janelaLivre(e.inicio, e.dias), id = e.id || 'livre-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const anoViagem = +e.inicio.slice(0, 4); editando = null;
      if (anoViagem !== ano) { ano = anoViagem; carregarPlanos().then(() => salvarPlano(id, { ano: anoViagem, status: 'vou', inicio: o.inicio, fim: o.fim, duracao: e.dias })); return; }
      return salvarPlano(id, { ano: anoViagem, status: 'vou', inicio: o.inicio, fim: o.fim, duracao: e.dias });
    }
    const cl = ev.target.closest('[data-livre]');
    if (cl && ev.target.closest('[data-apagar-livre]')) return apagarPlano(cl.dataset.livre);
    if (cl && ev.target.closest('[data-editar-livre]')) { const p = planos[cl.dataset.livre]; editando = { id: p.trip_id, mes: +p.inicio.slice(5, 7) - 1, inicio: p.inicio, dias: p.duracao }; return desenhar(); }
    const volta = ev.target.closest('[data-volta]'), voltaS = ev.target.closest('[data-volta-sempre]');
    if (volta) return salvarPlano(volta.dataset.volta, { status: null });
    if (voltaS) { const tira = [voltaS.dataset.voltaSempre, voltaS.dataset.voltaNome]; salvarPerfil({ feriados_ocultos: (perfil.feriados_ocultos || []).filter(x => !tira.includes(x)) }); return desenhar(); }
    const card = ev.target.closest('.trip'); if (!card) return;
    const id = card.dataset.id, x = F.cityTrips(ano).find(y => y.id === id), p = planos[id] || {};
    const dur = ev.target.closest('[data-dur]'), ideia = ev.target.closest('[data-ideia]'), acao = ev.target.closest('[data-acao]');
    if (dur) salvarPlano(id, { duracao: Math.min(16, +dur.dataset.dur) });
    else if (ideia) salvarPlano(id, { cidade: ideia.dataset.ideia, iata: null });
    else if (acao) {
      const a = acao.dataset.acao;
      if (a === 'vou') salvarPlano(id, { status: p.status === 'vou' ? null : 'vou' });
      if (a === 'agora-nao') salvarPlano(id, { status: 'agora-nao' });
      if (a === 'ocultar') { salvarPerfil({ feriados_ocultos: [...new Set([...(perfil.feriados_ocultos || []), x.chave])] }); desenhar(); }
    }
  });
  $('lista').addEventListener('change', ev => {
    if (ev.target.id === 'fl-ini' && ev.target.value) { editando.inicio = ev.target.value; return desenhar(); }
    if (ev.target.id === 'fl-dias') { editando.dias = Math.max(1, Math.min(60, Math.round(+ev.target.value) || 1)); return desenhar(); }
    const il = ev.target.closest('[data-cidade-livre]');
    if (il) return salvarPlano(il.closest('[data-livre]').dataset.livre, { cidade: il.value.trim() || null, iata: null });
    const inp = ev.target.closest('[data-cidade]'); if (!inp) return;
    salvarPlano(inp.closest('.trip').dataset.id, { cidade: inp.value.trim() || null, iata: null });
  });

  // ---------- Minhas viagens (lista + calendário) ----------
  let todosPlanos = null, anoCal = null, gastos = [], gastoAberto = null;
  async function carregarTodosPlanos() {
    const [r, g] = await Promise.all([
      sb.from('planos').select('*').eq('user_id', user.id).eq('status', 'vou'),
      sb.from('gastos').select('*').eq('user_id', user.id).order('created_at'),
    ]);
    if (r.error) msg('appMsg', t('err.viagens', { e: r.error.message }), 'erro');
    todosPlanos = r.data || []; gastos = g.data || [];
  }
  // ---------- Gastos da viagem ----------
  const TIPOS = ['passagem', 'hotel', 'transporte', 'comida', 'passeio', 'outro'], STATUS = ['comprado', 'reservado', 'previsto'];
  const MOEDAS = ['EUR', 'BRL', 'GBP', 'USD', 'CHF'];
  const EURO = new Set(['AT','BE','HR','CY','EE','FI','FR','DE','GR','IE','IT','LV','LT','LU','MT','NL','PT','SK','SI','ES','AD','MC','SM','VA','ME','XK']);
  const moedaPadrao = () => { const p = paisAtual(); return EURO.has(p) ? 'EUR' : ({ BR: 'BRL', GB: 'GBP', US: 'USD', CH: 'CHF', LI: 'CHF' })[p] || 'EUR'; };
  const dinheiro = (v, m) => { try { return new Intl.NumberFormat(loc(), { style: 'currency', currency: m }).format(v); } catch (e) { return m + ' ' + (+v).toFixed(2); } };
  const somaMoedas = lista => { const tot = {}; lista.forEach(g => { tot[g.moeda] = (tot[g.moeda] || 0) + +g.valor; }); return Object.entries(tot).map(([m, v]) => dinheiro(v, m)).join(' + '); };
  const gastosDe = p => gastos.filter(g => g.trip_id === p.trip_id && g.ano === p.ano);
  function blocoGastos(p) {
    const k = p.ano + '|' + p.trip_id, gs = gastosDe(p);
    let h = '<div class="gastos" data-gk="' + esc(k) + '"><div class="gastos-topo"><span class="rotulo">' + esc(t('gastos.titulo')) + '</span>' +
      (gs.length ? '<b>' + esc(somaMoedas(gs)) + '</b>' : '') + '</div>';
    h += gs.length ? '<ul class="limpa">' + gs.map(g => '<li class="gasto"><span class="g-tipo">' + esc(t('tp.' + g.tipo)) + (g.descricao ? ' <span class="sub">· ' + esc(g.descricao) + '</span>' : '') + '</span>' +
      '<span class="chip st-' + g.status + '">' + esc(t('st.' + g.status)) + '</span><span class="g-valor">' + esc(dinheiro(g.valor, g.moeda)) + '</span>' +
      '<button type="button" class="tag-x" data-del-gasto="' + g.id + '" aria-label="' + esc(t('apagar')) + '">×</button></li>').join('') + '</ul>' : '<p class="sub">' + esc(t('gastos.vazio')) + '</p>';
    if (gastoAberto === k) {
      h += '<form class="form-gasto" data-form-gasto>' +
        '<div class="dupla"><div class="form"><label for="g-tipo">' + esc(t('gastos.tipo')) + '</label><select id="g-tipo">' + TIPOS.map(x => '<option value="' + x + '">' + esc(t('tp.' + x)) + '</option>').join('') + '</select></div>' +
        '<div class="form"><label for="g-status">' + esc(t('gastos.status')) + '</label><select id="g-status">' + STATUS.map(x => '<option value="' + x + '">' + esc(t('st.' + x)) + '</option>').join('') + '</select></div></div>' +
        '<div class="dupla"><div class="form"><label for="g-valor">' + esc(t('gastos.valor')) + '</label><input type="number" id="g-valor" min="0" step="0.01" inputmode="decimal" required></div>' +
        '<div class="form"><label for="g-moeda">' + esc(t('gastos.moeda')) + '</label><select id="g-moeda">' + MOEDAS.map(m => '<option' + (m === moedaPadrao() ? ' selected' : '') + '>' + m + '</option>').join('') + '</select></div></div>' +
        '<label for="g-desc">' + esc(t('gastos.desc')) + '</label><input type="text" id="g-desc" maxlength="120" placeholder="' + esc(t('gastos.desc.ph')) + '">' +
        '<div class="acoes esq"><button type="submit" class="ir">' + esc(t('gastos.salvar')) + '</button><button type="button" class="leve" data-fechar-gasto>' + esc(t('cancelar')) + '</button></div>' +
        '<p class="msg" id="gMsg" role="status"></p></form>';
    } else h += '<button type="button" class="leve" data-abrir-gasto="' + esc(k) + '">' + esc(t('gastos.add')) + '</button>';
    return h + '</div>';
  }
  function viagensMarcadas() {
    const mapa = new Map((todosPlanos || []).map(p => [p.ano + '|' + p.trip_id, p]));
    Object.values(planos).forEach(p => mapa.set(p.ano + '|' + p.trip_id, p));
    return [...mapa.values()].filter(p => p.status === 'vou').map(p => {
      let o, rotulo;
      if (ehLivre(p.trip_id)) { if (!p.inicio) return null; o = janelaLivre(p.inicio, p.duracao); rotulo = t('livre.rotulo'); }
      else { const x = F.cityTrips(p.ano).find(y => y.id === p.trip_id); if (!x) return null; o = x.opcoes[p.duracao || x.padrao]; rotulo = x.feriado; }
      return { p, o, rotulo };
    }).filter(Boolean).sort((a, b) => a.o.inicio.localeCompare(b.o.inicio));
  }
  const diasAte = d => Math.round((Date.parse(d + 'T00:00:00Z') - Date.parse(hojeISO + 'T00:00:00Z')) / 864e5);
  async function desenharViagens() {
    if (!todosPlanos) await carregarTodosPlanos();
    if (aba !== 'viagens') return;
    const vs = viagensMarcadas(), futuras = vs.filter(v => v.o.fim >= hojeISO), passadas = vs.filter(v => v.o.fim < hojeISO).reverse();
    if (!anoCal) { const y = futuras[0] ? +futuras[0].o.inicio.slice(0, 4) : ano; anoCal = ANOS.includes(y) ? y : ano; }
    const doAno = vs.filter(v => v.o.inicio.slice(0, 4) === String(anoCal));
    const prox = futuras[0], agora = prox && prox.o.inicio <= hojeISO;
    const nomeV = v => v.p.cidade || t('viagens.cidadeDef');
    $('vResumo').innerHTML = !vs.length ? '<p class="sub">' + esc(t('viagens.nenhuma')) + '</p>' :
      (prox ? '<div class="rotulo">' + esc(agora ? t('viagens.agora') : t('viagens.proxima')) + '</div><div class="proxima"><b>' + esc(nomeV(prox)) + '</b><span>' +
        esc(agora ? fmt(prox.o.inicio) + ' → ' + fmt(prox.o.fim) : diasAte(prox.o.inicio) === 1 ? t('viagens.amanha') : t('viagens.emDias', { n: diasAte(prox.o.inicio) })) + '</span></div>' : '') +
      '<p class="sub">' + esc(t(doAno.length === 1 ? 'viagens.resumo1' : 'viagens.resumo', { n: doAno.length, d: doAno.reduce((s, v) => s + v.o.custo, 0), ano: anoCal })) + '</p>' +
      (() => { const gs = doAno.flatMap(v => gastosDe(v.p)); return gs.length ? '<p class="sub">' + esc(t('gastos.ano', { ano: anoCal })) + ' <b class="total-ano">' + esc(somaMoedas(gs)) + '</b></p>' : ''; })();
    // calendário do ano
    $('vCalTitulo').textContent = t('viagens.calendario', { ano: anoCal });
    $('vAnos').innerHTML = ANOS.map(y => '<button type="button" data-ano-cal="' + y + '" aria-pressed="' + (y === anoCal) + '">' + y + '</button>').join('');
    const viagemDia = new Map(), folga = new Set(), fer = new Map(F.feriados(anoCal).map(h => [h.data, h.nome]));
    vs.forEach((v, i) => { for (let k = 0; k < v.o.total; k++) viagemDia.set(somaDias(v.o.inicio, k), i); v.o.tirar.forEach(d => folga.add(d)); });
    const sem = [...Array(7)].map((_, i) => new Intl.DateTimeFormat(loc(), { weekday: 'narrow', timeZone: 'UTC' }).format(Date.UTC(2024, 0, 1 + i))); // 1/1/2024 = segunda
    let cal = '';
    for (let m = 0; m < 12; m++) {
      const n = new Date(Date.UTC(anoCal, m + 1, 0)).getUTCDate(), pula = (new Date(Date.UTC(anoCal, m, 1)).getUTCDay() + 6) % 7;
      cal += '<div class="cal-mes"><div class="cal-nome">' + esc(nomeMes(m)) + '</div><div class="cal-grade">' + sem.map(d => '<span class="cal-sem">' + esc(d) + '</span>').join('') + '<span></span>'.repeat(pula);
      for (let d = 1; d <= n; d++) {
        const iso = anoCal + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'), vi = viagemDia.get(iso);
        const cls = [vi != null ? 'viagem' : '', folga.has(iso) ? 'folga' : '', fer.has(iso) ? 'feriado' : '', iso === hojeISO ? 'hoje' : ''].filter(Boolean).join(' ');
        const tit = [fer.get(iso), vi != null ? nomeV(vs[vi]) : ''].filter(Boolean).join(' · ');
        cal += '<span class="cal-dia ' + cls + '"' + (vi != null ? ' data-vi="' + vi + '"' : '') + (tit ? ' title="' + esc(tit) + '"' : '') + '>' + d + '</span>';
      }
      cal += '</div></div>';
    }
    $('vCal').innerHTML = cal;
    // lista
    const cartao = (v, i) => '<article class="trip vou" id="v-' + i + '"><div class="linha1"><div><div class="rotulo">' + esc(v.rotulo) + '</div><div class="datas">' + esc(nomeV(v)) + '</div>' +
      '<div class="sub">' + esc(fmt(v.o.inicio)) + ' → ' + esc(fmt(v.o.fim)) + ' · ' + esc(t('trip.dias', { n: v.o.total })) + '</div></div>' +
      '<div class="custo"><b' + (v.o.custo === 0 ? ' class="zero"' : '') + '>' + esc(nDias(v.o.custo)) + '</b><span class="sub">' + esc(t('deFerias')) + '</span></div></div>' +
      '<div class="sub">' + esc(v.o.tirar.length ? t('pedirFolga', { d: v.o.tirar.length > 6 ? fmt(v.o.tirar[0]) + ' … ' + fmt(v.o.tirar[v.o.tirar.length - 1]) + ' (' + v.o.tirar.length + ')' : v.o.tirar.map(fmt).join(', ') }) : t('semPedir')) + '</div>' +
      (v.p.cidade ? linksViagem(v.rotulo, v.o, v.p) : '<div class="acoes esq links">' + linkQualquerLugar(v.o) + '</div>') +
      blocoGastos(v.p) +
      '<div class="acoes esq"><button type="button" class="leve" data-abrir="' + esc(v.p.trip_id) + '" data-abrir-ano="' + v.p.ano + '">' + esc(t('viagens.ver')) + '</button></div></article>';
    $('vLista').innerHTML = (futuras.length ? '<h3>' + esc(t('viagens.futuras')) + '</h3>' + futuras.map(v => cartao(v, vs.indexOf(v))).join('') : '') +
      (passadas.length ? '<details class="passadas"><summary>' + esc(t('viagens.passadas', { n: passadas.length })) + '</summary>' + passadas.map(v => cartao(v, vs.indexOf(v))).join('') + '</details>' : '');
  }
  $('vAnos').addEventListener('click', ev => { const b = ev.target.closest('[data-ano-cal]'); if (b) { anoCal = +b.dataset.anoCal; desenharViagens(); } });
  $('vCal').addEventListener('click', ev => { const d = ev.target.closest('[data-vi]'); if (d) { const c = $('v-' + d.dataset.vi); if (c) { if (c.closest('details')) c.closest('details').open = true; c.scrollIntoView({ behavior: 'smooth', block: 'center' }); } } });
  $('vLista').addEventListener('submit', async ev => {
    const f = ev.target.closest('[data-form-gasto]'); if (!f) return;
    ev.preventDefault();
    const [a, ...rest] = gastoAberto.split('|'), trip_id = rest.join('|'), valor = Math.round(+$('g-valor').value * 100) / 100;
    if (!(valor >= 0) || $('g-valor').value === '') return msg('gMsg', t('err.valor'), 'erro');
    const novo = { ano: +a, trip_id, tipo: $('g-tipo').value, status: $('g-status').value, valor, moeda: $('g-moeda').value, descricao: $('g-desc').value.trim() || null };
    const { data, error } = await sb.from('gastos').insert(novo).select().single();
    if (error) return msg('gMsg', t('err.salvarE', { e: error.message }), 'erro');
    gastos.push(data); gastoAberto = null; desenharViagens();
  });
  $('vLista').addEventListener('click', async ev => {
    const ag = ev.target.closest('[data-abrir-gasto]'), fg = ev.target.closest('[data-fechar-gasto]'), dg = ev.target.closest('[data-del-gasto]');
    if (ag) { gastoAberto = ag.dataset.abrirGasto; await desenharViagens(); const i = $('g-valor'); if (i) i.focus(); return; }
    if (fg) { gastoAberto = null; return desenharViagens(); }
    if (dg) { const id = dg.dataset.delGasto; gastos = gastos.filter(g => g.id !== id); desenharViagens(); const { error } = await sb.from('gastos').delete().eq('id', id); if (error) msg('appMsg', t('err.salvarE', { e: error.message }), 'erro'); return; }
    const b = ev.target.closest('[data-abrir]'); if (!b) return;
    const a = +b.dataset.abrirAno, id = b.dataset.abrir;
    if (a !== ano && ANOS.includes(a)) { ano = a; try { localStorage.setItem('tripsync:ano', ano); } catch (e) {} await carregarPlanos(); }
    location.hash = 'escapadas';
    setTimeout(() => { const el = document.querySelector('[data-id="' + id + '"], [data-livre="' + id + '"]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
  });

  // ---------- Já fui ----------
  let mapaFeito = false;
  function desenharJaFui() {
    const pv = paisesVisitados();
    $('nPaises').textContent = pv.size; $('nPct').textContent = Math.round(pv.size / 195 * 100) + '%';
    $('nCidades').textContent = visitados.filter(v => v.cidade).length;
    if (!CIDS) carregarCidades();
    if (!mapaFeito) { desenharMapa($('mapa')); mapaFeito = true; }
    $('mapa').querySelectorAll('path.p').forEach(p => p.classList.toggle('foi', pv.has(p.dataset.a2)));
    $('tituloLista').textContent = pv.size ? t('seusPaises') : t('ondeFoi');
    const q = norm($('buscaPais').value);
    const lista = LISTA_PAISES.filter(([a, n]) => !q || norm(n).includes(q)).sort((x, y) => (pv.has(y[0]) - pv.has(x[0])) || x[1].localeCompare(y[1], loc()));
    $('listaPaises').innerHTML = lista.map(([a, n]) => {
      const foi = pv.has(a), cs = visitados.filter(v => v.a2 === a && v.cidade);
      return '<li class="lp' + (foi ? ' foi' : '') + '"><div class="lp-top"><span class="bandeira" aria-hidden="true">' + bandeira(a) + '</span><span class="nome">' + esc(n) + '</span>' +
        '<button type="button" class="marca" data-marca="' + a + '" aria-pressed="' + foi + '">' + esc(foi ? t('jaFuiOk') : t('jaFuiBtn')) + '</button></div>' +
        (foi ? '<div class="lp-cid">' + cs.map(v => '<button type="button" class="tag-x" data-remove="' + v.id + '" aria-label="' + esc(t('aria.remover', { c: v.cidade })) + '">' + esc(v.cidade) + ' ×</button>').join('') +
          campoCidade(a, n, cs) + '</div>' : '') + '</li>';
    }).join('') || '<li class="sub">' + esc(t('nenhumPais')) + '</li>';
  }
  // Lista das maiores cidades de cada país (cidades.json, carregada uma vez)
  let CIDS = null, outraAberta = null;
  async function carregarCidades() {
    if (CIDS) return;
    try { const r = await fetch('cidades.json'); CIDS = r.ok ? await r.json() : {}; } catch (e) { CIDS = {}; }
    if (aba === 'jafui') desenharJaFui();
  }
  function campoCidade(a, n, cs) {
    const texto = '<input type="text" data-add-cidade="' + a + '" placeholder="' + esc(t('addCidade')) + '" aria-label="' + esc(t('aria.addCidade', { p: n })) + '" autocomplete="off">';
    const lista = ((CIDS || {})[a] || []).filter(c => !cs.some(v => norm(v.cidade) === norm(c)));
    if (outraAberta === a || !lista.length) return texto;
    return '<select class="sel-cidade" data-sel-cidade="' + a + '" aria-label="' + esc(t('aria.addCidade', { p: n })) + '"><option value="">' + esc(t('escolherCidade')) + '</option>' +
      lista.map(c => '<option>' + esc(c) + '</option>').join('') + '<option value="__outra">' + esc(t('outraCidade')) + '</option></select>';
  }
  async function addCidade(a, cidade) {
    cidade = cidade.trim(); if (!cidade) return;
    if (visitados.some(v => v.a2 === a && norm(v.cidade) === norm(cidade))) return;
    const { data, error } = await sb.from('visitados').insert({ cidade, pais: PAIS_PT[a] || a, a2: a }).select().single();
    if (error) { msg('appMsg', t('err.cidade', { e: error.message }), 'erro'); return; }
    visitados.push(data); desenhar();
  }
  async function marcarPais(a) {
    const pv = paisesVisitados();
    if (pv.has(a)) {
      const ids = visitados.filter(v => v.a2 === a).map(v => v.id);
      visitados = visitados.filter(v => v.a2 !== a);
      if (ids.length) await sb.from('visitados').delete().in('id', ids);
      await salvarPerfil({ paises_visitados: (perfil.paises_visitados || []).filter(x => x !== a) });
    } else await salvarPerfil({ paises_visitados: [...new Set([...(perfil.paises_visitados || []), a])] });
    desenhar();
  }
  $('buscaPais').addEventListener('input', desenharJaFui);
  $('mapa').addEventListener('click', ev => { const p = ev.target.closest('path.p'); if (p) marcarPais(p.dataset.a2); });
  $('listaPaises').addEventListener('click', async ev => {
    const m = ev.target.closest('[data-marca]'), r = ev.target.closest('[data-remove]');
    if (m) marcarPais(m.dataset.marca);
    else if (r) { visitados = visitados.filter(v => v.id !== r.dataset.remove); desenhar(); await sb.from('visitados').delete().eq('id', r.dataset.remove); }
  });
  $('listaPaises').addEventListener('keydown', async ev => {
    const inp = ev.target.closest('[data-add-cidade]'); if (!inp || ev.key !== 'Enter') return;
    const a = inp.dataset.addCidade; outraAberta = null; await addCidade(a, inp.value); inp.value = '';
    const novo = document.querySelector('[data-add-cidade="' + a + '"]'); if (novo) novo.focus();
  });

  $('listaPaises').addEventListener('change', async ev => {
    const sel = ev.target.closest('[data-sel-cidade]'); if (!sel || !sel.value) return;
    const a = sel.dataset.selCidade;
    if (sel.value === '__outra') { outraAberta = a; desenharJaFui(); const i = document.querySelector('[data-add-cidade="' + a + '"]'); if (i) i.focus(); return; }
    await addCidade(a, sel.value);
  });

  // ---------- Amigos (grupos) ----------
  async function desenharGrupos() {
    $('meusGrupos').innerHTML = grupos.length ? grupos.map(g => '<div class="grupo"><button type="button" class="nome" data-grupo="' + g.id + '">' + esc(g.nome) + '</button>' +
      '<span class="sub">' + esc(t('convite')) + ' <span class="codigo">' + esc(g.codigo_convite) + '</span></span></div>').join('')
      : '<p class="sub">' + esc(t('semGrupo')) + '</p>';
    if (!grupoAberto && grupos.length) grupoAberto = grupos[0].id;
    if (grupoAberto) await desenharGrupo(grupoAberto); else $('grupoDetalhe').innerHTML = '';
  }
  async function desenharGrupo(gid) {
    const g = grupos.find(x => x.id === gid); if (!g) return;
    const { data: mem } = await sb.from('grupo_membros').select('user_id,papel').eq('grupo_id', gid);
    const ids = (mem || []).map(m => m.user_id);
    const convite = t('convite.texto', { link: location.origin + location.pathname, cod: g.codigo_convite });
    const trips = F.cityTrips(ano);
    const linhas = trips.map(x => {
      const doT = planosGrupo.filter(r => r.trip_id === x.id && ids.includes(r.user_id));
      const vao = doT.filter(r => r.status === 'vou'), nao = doT.filter(r => r.status === 'agora-nao').map(r => r.user_id);
      return { x, vao, nao };
    }).sort((a, b) => (b.vao.length - a.vao.length) || (a.nao.length - b.nao.length) || a.x.data.localeCompare(b.x.data));
    const nome = id => id === user.id ? t('voce') : ((perfisGrupo[id] || {}).nome || t('alguem'));
    const mini = id => { const p = perfisGrupo[id] || {}; return '<span class="mini" style="' + (p.foto_url ? 'background-image:url(&quot;' + esc(p.foto_url) + '&quot;)' : '') + '">' + (p.foto_url ? '' : esc(iniciais(p.nome))) + '</span>'; };
    $('grupoDetalhe').innerHTML = '<div class="cartao"><h3>' + esc(g.nome) + '</h3>' +
      '<div class="membros">' + ids.map(id => '<span class="membro">' + mini(id) + esc(nome(id)) + '</span>').join('') + '</div>' +
      '<div class="acoes esq"><button type="button" class="ir" data-convite="' + esc(convite) + '">' + esc(t('copiarConvite')) + '</button><span class="sub">' + esc(t('codigo')) + ' <span class="codigo">' + esc(g.codigo_convite) + '</span></span>' +
      '<button type="button" class="leve" data-sair="' + g.id + '">' + esc(t('sairGrupo')) + '</button></div></div>' +
      (() => {
        const lv = planosGrupo.filter(r => ehLivre(r.trip_id) && r.inicio && ids.includes(r.user_id)).sort((a, b) => a.inicio.localeCompare(b.inicio));
        return lv.length ? '<h3>' + esc(t('grupo.livres', { ano })) + '</h3><div class="cartao">' + lv.map(r => '<div class="grupo"><span>' + mini(r.user_id) + ' <b>' + esc(nome(r.user_id)) + '</b>' + (r.cidade ? ' · ' + esc(r.cidade) : '') + '</span>' +
          '<span class="sub">' + esc(fmt(r.inicio)) + ' → ' + esc(fmt(r.fim)) + ' · ' + esc(t('trip.dias', { n: r.duracao })) + '</span></div>').join('') + '</div>' : '';
      })() +
      '<h3>' + esc(t('grupo.titulo', { ano })) + '</h3>' + linhas.map(({ x, vao, nao }) => {
        const o = x.opcoes[x.padrao], livres = ids.filter(id => !vao.some(r => r.user_id === id) && !nao.includes(id));
        return '<div class="trip' + (vao.length > 1 ? ' vou' : '') + '"><div class="linha1"><div><div class="datas" style="font-size:18px">' + esc(fmt(o.inicio)) + ' → ' + esc(fmt(o.fim)) + '</div><div class="sub">' + esc(t('grupo.linha', { f: x.feriado, n: o.total, c: o.custo })) + '</div></div>' +
          '<div class="custo"><b>' + vao.length + '</b><span class="sub">' + esc(vao.length === 1 ? t('vai1') : t('vaoN')) + '</span></div></div><div class="chips">' +
          vao.map(r => '<span class="chip vou">' + esc(t('vaiNome', { n: nome(r.user_id) })) + (r.cidade ? ' · ' + esc(r.cidade) : '') + '</span>').join('') +
          livres.map(id => '<span class="chip">' + esc(t('naoDecidiu', { n: nome(id) })) + '</span>').join('') +
          nao.map(id => '<span class="chip nao">' + esc(nome(id)) + '</span>').join('') + '</div></div>';
      }).join('');
  }
  $('meusGrupos').addEventListener('click', ev => { const b = ev.target.closest('[data-grupo]'); if (b) { grupoAberto = b.dataset.grupo; desenharGrupo(grupoAberto); } });
  $('grupoDetalhe').addEventListener('click', async ev => {
    const c = ev.target.closest('[data-convite]'), s = ev.target.closest('[data-sair]');
    if (c) {
      const texto = c.dataset.convite;
      try { if (navigator.share) await navigator.share({ text: texto }); else { await navigator.clipboard.writeText(texto); c.textContent = t('copiado'); } }
      catch (e) { try { await navigator.clipboard.writeText(texto); c.textContent = t('copiado'); } catch (e2) { prompt(t('copieConvite'), texto); } }
    }
    if (s) {
      if (!confirm(t('confirmSair'))) return;
      await sb.from('grupo_membros').delete().eq('grupo_id', s.dataset.sair).eq('user_id', user.id);
      grupos = grupos.filter(g => g.id !== s.dataset.sair); grupoAberto = null; desenharGrupos();
    }
  });
  $('formCriarGrupo').addEventListener('submit', async ev => {
    ev.preventDefault();
    const { data, error } = await sb.rpc('criar_grupo', { p_nome: $('gNome').value.trim() });
    if (error) return msg('appMsg', t('err.criarGrupo', { e: error.message }), 'erro');
    $('gNome').value = ''; grupos.push(data); grupoAberto = data.id; msg('appMsg', t('ok.grupoCriado'), 'ok'); desenharGrupos();
  });
  $('formEntrarGrupo').addEventListener('submit', async ev => {
    ev.preventDefault();
    const { data, error } = await sb.rpc('entrar_no_grupo', { p_codigo: $('gCodigo').value.trim() });
    if (error) return msg('appMsg', /inválido/.test(error.message) ? t('err.codigo') : t('err.entrar', { e: error.message }), 'erro');
    $('gCodigo').value = '';
    if (!grupos.some(g => g.id === data.id)) grupos.push(data);
    grupoAberto = data.id; await carregarPlanos(); await carregarPerfisGrupo();
    msg('appMsg', t('ok.entrou', { g: data.nome }), 'ok'); desenharGrupos();
  });

  // ---------- Perfil ----------
  function desenharPerfil() {
    $('pNome').value = perfil.nome || ''; $('pSobrenome').value = perfil.sobrenome || ''; opcoesPais($('pPais'), perfil.pais || ''); opcoesIdioma($('pIdioma'));
    $('pTel').value = perfil.telefone || ''; $('pNasc').value = perfil.data_nascimento || '';
    $('pCidade').value = perfil.cidade_base || ''; $('pDias').value = perfil.dias_ferias ?? ''; $('pEmail').textContent = user.email;
    const f = $('fotoPrev');
    if (perfil.foto_url) { f.style.backgroundImage = 'url("' + perfil.foto_url + '")'; f.textContent = ''; } else { f.style.backgroundImage = ''; f.textContent = iniciais(perfil.nome); }
  }
  $('formPerfil').addEventListener('submit', async ev => {
    ev.preventDefault();
    const paisAntes = perfil.pais, idioma = $('pIdioma').value;
    const ok = await salvarPerfil({ nome: $('pNome').value.trim() || null, sobrenome: $('pSobrenome').value.trim() || null, pais: $('pPais').value || null,
      telefone: $('pTel').value.trim() || null, data_nascimento: $('pNasc').value || null, idioma,
      cidade_base: $('pCidade').value.trim() || null, dias_ferias: Math.max(0, Math.min(60, +$('pDias').value || 0)) });
    if (ok && idioma !== I.lang) await trocarIdioma(idioma, false);
    if (ok && perfil.pais !== paisAntes) {
      await prepararFeriados();
      if (perfil.pais && !(perfil.paises_visitados || []).includes(perfil.pais)) await salvarPerfil({ paises_visitados: [...(perfil.paises_visitados || []), perfil.pais] });
    }
    desenhar(); msg('pMsg', ok ? t('ok.perfil') : t('err.perfilSalvar'), ok ? 'ok' : 'erro');
  });
  $('pFoto').addEventListener('change', async () => {
    const file = $('pFoto').files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) return msg('pMsg', t('err.foto5'), 'erro');
    msg('pMsg', t('enviandoFoto'));
    const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg'), caminho = user.id + '/avatar-' + Date.now() + '.' + ext;
    const { error } = await sb.storage.from('avatars').upload(caminho, file, { contentType: file.type });
    if (error) return msg('pMsg', t('err.foto', { e: error.message }), 'erro');
    const url = sb.storage.from('avatars').getPublicUrl(caminho).data.publicUrl;
    const ok = await salvarPerfil({ foto_url: url });
    msg('pMsg', ok ? t('ok.foto') : t('err.fotoSalvar'), ok ? 'ok' : 'erro'); desenhar();
  });

  // Início: textos no idioma do aparelho (ou o último escolhido)
  nomesPaises(); I.aplicar(); opcoesIdioma($('idiomaTopo'));

  // PWA: funciona offline para abrir o app
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
