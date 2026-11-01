/* Tripsync: escapadas nos feriados belgas, combinadas com amigos. Dados no Supabase (login, perfil, grupos). */
(function () {
  const C = window.TRIPSYNC_CONFIG, F = window.Ferias;
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey);
  const $ = id => document.getElementById(id);
  const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const SEM = ['dom','seg','ter','qua','qui','sex','sáb'];
  const fmt = d => { const t = new Date(d.slice(0, 10) + 'T00:00:00Z'); return SEM[t.getUTCDay()] + ' ' + t.getUTCDate() + ' ' + MESES[t.getUTCMonth()].slice(0, 3); };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const diaSeg = d => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
  const msg = (id, texto, tipo) => { const el = $(id); el.textContent = texto || ''; el.className = 'msg' + (tipo ? ' ' + tipo : ''); };
  const iniciais = n => (n || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();

  // ---------- Destinos (a partir de Bruxelas) ----------
  const TODOS = [0,1,2,3,4,5,6,7,8,9,10,11], VERAO = [4,5,6,7,8], MEIO = [2,3,4,5,6,7,8,9,10];
  const CIDADES = [
    ['Paris','FR','trem 1h20',3,TODOS,''],['Amsterdã','NL','trem 2h',3,TODOS,''],['Londres','GB','trem 2h',3,TODOS,''],
    ['Lisboa','PT','2h45 de voo',3,TODOS,'LIS'],['Porto','PT','2h20 de voo',3,MEIO,'OPO'],['Barcelona','ES','2h de voo',3,MEIO,'BCN'],
    ['Madri','ES','2h15 de voo',3,TODOS,'MAD'],['Sevilha','ES','2h40 de voo',3,[0,1,2,3,4,9,10,11],'SVQ'],['Málaga','ES','2h50 de voo',3,TODOS,'AGP'],
    ['Roma','IT','2h10 de voo',3,MEIO,'FCO'],['Veneza','IT','1h40 de voo',3,MEIO,'VCE'],['Florença','IT','1h50 de voo',3,[3,4,5,8,9],'FLR'],
    ['Nápoles','IT','2h20 de voo',4,[3,4,5,8,9],'NAP'],['Praga','CZ','1h20 de voo',3,TODOS,'PRG'],['Viena','AT','1h40 de voo',3,TODOS,'VIE'],
    ['Budapeste','HU','2h de voo',3,TODOS,'BUD'],['Cracóvia','PL','2h de voo',3,[3,4,5,6,7,8,9,11],'KRK'],['Berlim','DE','1h20 de voo',3,TODOS,'BER'],
    ['Copenhague','DK','1h25 de voo',3,VERAO,'CPH'],['Estocolmo','SE','2h de voo',3,VERAO,'ARN'],['Edimburgo','GB','1h40 de voo',3,VERAO,'EDI'],
    ['Dublin','IE','1h30 de voo',3,TODOS,'DUB'],['Split','HR','2h20 de voo',4,VERAO,'SPU'],['Dubrovnik','HR','2h40 de voo',4,[4,5,6,7,8,9],'DBV'],
    ['Zagreb','HR','1h50 de voo',3,[3,4,5,8,9,11],'ZAG'],['Atenas','GR','3h15 de voo',4,[3,4,5,8,9],'ATH'],['Istambul','TR','3h30 de voo',4,[3,4,5,8,9,10],'IST'],
    ['Marrakech','MA','3h30 de voo',4,[0,1,2,3,9,10,11],'RAK'],['Tenerife','ES','4h30 de voo',5,[0,1,2,3,10,11],'TFS'],['Nice','FR','1h40 de voo',3,[3,4,5,6,7,8,9],'NCE'],
    ['Valência','ES','2h15 de voo',3,MEIO,'VLC'],['Palermo','IT','2h40 de voo',4,[3,4,5,8,9],'PMO'],['Malta','MT','3h de voo',4,[3,4,5,8,9,10],'MLA'],
    ['Munique','DE','1h15 de voo',3,TODOS,'MUC'],['Liubliana','SI','1h45 de voo',3,MEIO,'LJU'],['Riga','LV','2h30 de voo',3,VERAO,'RIX'],
    ['Tallinn','EE','2h40 de voo',3,[4,5,6,7,8,11],'TLL'],['Bolonha','IT','1h50 de voo',3,MEIO,'BLQ'],['Gdańsk','PL','1h55 de voo',3,VERAO,'GDN'],
    ['Funchal','PT','4h de voo',4,TODOS,'FNC'],
  ].map(([nome, a2, voo, min, meses, iata]) => ({ nome, a2, voo, min, meses, iata }));
  const PAIS_NOME = Object.fromEntries(window.PAISES || []);
  const bandeira = a2 => /^[A-Z]{2}$/.test(a2) && a2 !== 'XK' ? String.fromCodePoint(...[...a2].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : '🏳️';

  // ---------- Estado ----------
  let user = null, perfil = null, planos = {}, planosGrupo = [], visitados = [], grupos = [], perfisGrupo = {}, grupoAberto = null;
  const hoje = new Date(), anoHoje = hoje.getFullYear(), ANOS = [anoHoje, anoHoje + 1, anoHoje + 2];
  let ano = anoHoje + 1, aba = 'escapadas', modoLogin = 'entrar';

  // ---------- Login ----------
  function mostrarLogin(modo) {
    modoLogin = modo || modoLogin;
    $('tela-login').hidden = false; $('tela-app').hidden = true; $('btnPerfil').hidden = true;
    const t = { entrar: ['Entrar', 'Entrar', 'Ainda não tenho conta'], criar: ['Criar conta', 'Criar conta', 'Já tenho conta'], 'nova-senha': ['Nova senha', 'Salvar senha', 'Voltar'] }[modoLogin];
    $('loginTitulo').textContent = t[0]; $('lBotao').textContent = t[1]; $('trocaModo').textContent = t[2];
    $('campoNome').hidden = modoLogin !== 'criar';
    $('lEmail').closest('form').querySelector('label[for="lEmail"]').hidden = $('lEmail').hidden = modoLogin === 'nova-senha';
    $('lEmail').required = modoLogin !== 'nova-senha';
    $('lSenha').autocomplete = modoLogin === 'entrar' ? 'current-password' : 'new-password';
    $('esqueci').hidden = modoLogin !== 'entrar';
  }
  $('trocaModo').onclick = () => { msg('lMsg'); mostrarLogin(modoLogin === 'entrar' ? 'criar' : 'entrar'); };
  $('esqueci').onclick = async () => {
    const email = $('lEmail').value.trim();
    if (!email) { msg('lMsg', 'Escreva seu e-mail acima e toque de novo em Esqueci a senha.', 'erro'); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    msg('lMsg', error ? 'Não consegui enviar: ' + error.message : 'Mandei um link para ' + email + ' para você criar uma senha nova.', error ? 'erro' : 'ok');
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
        const { data, error } = await sb.auth.signUp({ email, password: senha, options: { data: { nome: $('lNome').value.trim() }, emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        if (!data.session) msg('lMsg', 'Conta criada. Abra o e-mail que mandei para ' + email + ' e confirme para entrar.', 'ok');
      } else {
        const { error } = await sb.auth.updateUser({ password: senha });
        if (error) throw error;
        msg('appMsg', 'Senha trocada.', 'ok'); modoLogin = 'entrar';
        const { data } = await sb.auth.getSession(); if (data.session) entrar(data.session);
      }
    } catch (e) {
      const m = /invalid login/i.test(e.message) ? 'E-mail ou senha errados.' : /already registered/i.test(e.message) ? 'Esse e-mail já tem conta. Toque em "Já tenho conta".' :
        /email not confirmed/i.test(e.message) ? 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).' : /password/i.test(e.message) ? 'A senha precisa ter pelo menos 8 caracteres.' : e.message;
      msg('lMsg', m, 'erro');
    } finally { $('lBotao').disabled = false; }
  });
  $('sair').onclick = async () => { await sb.auth.signOut(); };

  sb.auth.onAuthStateChange((evento, session) => {
    if (evento === 'PASSWORD_RECOVERY') { mostrarLogin('nova-senha'); return; }
    if (session && session.user) { if (!user || user.id !== session.user.id) entrar(session); }
    else { user = null; mostrarLogin('entrar'); }
  });

  async function entrar(session) {
    user = session.user;
    $('tela-login').hidden = true; $('tela-app').hidden = false; $('btnPerfil').hidden = false;
    try { const a = +localStorage.getItem('tripsync:ano'); if (ANOS.includes(a)) ano = a; } catch (e) {}
    await carregarTudo();
    irPara();
  }

  // ---------- Dados ----------
  async function carregarTudo() {
    const [p, v, g] = await Promise.all([
      sb.from('profiles').select('*').eq('id', user.id).single(),
      sb.from('visitados').select('*').eq('user_id', user.id).order('created_at'),
      sb.from('grupos').select('*').order('created_at'),
    ]);
    if (p.error) msg('appMsg', 'Não consegui carregar seu perfil: ' + p.error.message, 'erro');
    perfil = p.data || { id: user.id, dias_ferias: 20, feriados_ocultos: [], paises_visitados: [] };
    visitados = v.data || []; grupos = g.data || [];
    await carregarPlanos();
    await carregarPerfisGrupo();
  }
  async function carregarPlanos() {
    const { data, error } = await sb.from('planos').select('*').eq('ano', ano);
    if (error) { msg('appMsg', 'Não consegui carregar as viagens: ' + error.message, 'erro'); return; }
    planos = {}; planosGrupo = data || [];
    planosGrupo.filter(r => r.user_id === user.id).forEach(r => { planos[r.trip_id] = r; });
  }
  async function carregarPerfisGrupo() {
    const { data } = await sb.from('profiles').select('id,nome,foto_url');
    perfisGrupo = Object.fromEntries((data || []).map(p => [p.id, p]));
  }
  async function salvarPlano(tripId, patch) {
    const atual = planos[tripId] || { user_id: user.id, ano, trip_id: tripId };
    const novo = Object.assign({}, atual, patch);
    planos[tripId] = novo; desenhar();
    const { user_id, ano: a, trip_id, status, duracao, cidade, iata } = novo;
    const { error } = await sb.from('planos').upsert({ user_id, ano: a, trip_id, status: status || null, duracao: duracao || null, cidade: cidade || null, iata: iata || null });
    if (error) msg('appMsg', 'Não consegui salvar: ' + error.message, 'erro');
    else { const i = planosGrupo.findIndex(r => r.user_id === user.id && r.trip_id === tripId); if (i >= 0) planosGrupo[i] = novo; else planosGrupo.push(novo); }
  }
  async function salvarPerfil(patch) {
    Object.assign(perfil, patch);
    const { error } = await sb.from('profiles').update(patch).eq('id', user.id);
    if (error) msg('appMsg', 'Não consegui salvar: ' + error.message, 'erro');
    return !error;
  }

  // ---------- Navegação ----------
  function irPara() { const h = location.hash.slice(1); aba = ['escapadas', 'jafui', 'grupos', 'perfil'].includes(h) ? h : 'escapadas'; desenhar(); }
  window.addEventListener('hashchange', () => { if (user) irPara(); });
  $('btnPerfil').onclick = () => { location.hash = 'perfil'; };

  function desenhar() {
    if (!user || !perfil) return;
    document.querySelectorAll('.abas a').forEach(a => a.setAttribute('aria-current', a.dataset.aba === aba ? 'page' : 'false'));
    ['escapadas', 'jafui', 'grupos', 'perfil'].forEach(k => { $('aba-' + k).hidden = k !== aba; });
    const b = $('btnPerfil');
    if (perfil.foto_url) { b.style.backgroundImage = 'url("' + perfil.foto_url + '")'; b.textContent = ''; } else { b.style.backgroundImage = ''; b.textContent = iniciais(perfil.nome); }
    if (aba === 'escapadas') desenharEscapadas();
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
    const vc = new Set(visitados.map(v => norm(v.cidade))), pv = paisesVisitados();
    const ok = CIDADES.filter(c => c.meses.includes(mes) && c.min <= L && !vc.has(norm(c.nome)));
    const novos = ok.filter(c => !pv.has(c.a2)), base = novos.length >= 3 ? novos : ok, n = base.length, out = [];
    base.sort((a, b) => L >= 4 ? b.min - a.min : a.min - b.min);
    for (let k = 0; k < Math.min(4, n); k++) out.push(base[(semente * 3 + k * Math.max(1, Math.floor(n / 4))) % n]);
    return [...new Map(out.map(c => [c.nome, c])).values()];
  }
  function gasto() {
    return F.cityTrips(ano).reduce((s, t) => { const p = planos[t.id]; return s + (p && p.status === 'vou' ? t.opcoes[p.duracao || t.padrao].custo : 0); }, 0);
  }
  function linksViagem(t, o, p) {
    const cid = CIDADES.find(c => norm(c.nome) === norm(p.cidade));
    const iata = (p.iata || (cid && cid.iata) || '').toUpperCase();
    const voos = 'https://www.google.com/travel/flights?hl=pt-BR&q=' + encodeURIComponent('voos de Bruxelas para ' + (iata || p.cidade) + ' ida ' + o.inicio + ' volta ' + o.fim);
    const hotel = 'https://www.booking.com/searchresults.html?ss=' + encodeURIComponent(p.cidade) + '&checkin=' + o.inicio + '&checkout=' + o.fim + '&group_adults=1&no_rooms=1&nflt=ht_id%3D204';
    const agenda = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent('Viagem: ' + p.cidade) +
      '&dates=' + o.inicio.replace(/-/g, '') + '/' + diaSeg(o.fim).replace(/-/g, '') + '&location=' + encodeURIComponent(p.cidade) +
      '&details=' + encodeURIComponent('Escapada de ' + o.total + ' dias (' + t.feriado + '). Pedir folga: ' + (o.tirar.map(fmt).join(', ') || 'nenhum dia') + '. Criado pelo Tripsync.');
    const trem = cid && /trem/.test(cid.voo);
    return '<div class="acoes esq links">' + (trem ? '<a href="https://www.eurostar.com" target="_blank" rel="noopener">Trens (Eurostar) ↗</a>' : '<a href="' + voos + '" target="_blank" rel="noopener">Voos ↗</a>') +
      '<a href="' + hotel + '" target="_blank" rel="noopener">Hotéis, sem hostel ↗</a><a href="' + agenda + '" target="_blank" rel="noopener">Pôr na Google Agenda ↗</a></div>';
  }
  function amigosNaTrip(tripId) {
    return planosGrupo.filter(r => r.trip_id === tripId && r.user_id !== user.id && r.status === 'vou')
      .map(r => '<span class="chip vou">' + esc((perfisGrupo[r.user_id] || {}).nome || 'Amigo') + ' vai' + (r.cidade ? ' · ' + esc(r.cidade) : '') + '</span>').join('');
  }
  function desenharEscapadas() {
    $('anos').innerHTML = ANOS.map(y => '<button type="button" data-ano="' + y + '" aria-pressed="' + (y === ano) + '">' + y + '</button>').join('');
    const trips = F.cityTrips(ano), fds = F.feriadosBelgica(ano).filter(h => h.fimDeSemana), ORC = (perfil.dias_ferias ?? 20) + fds.length, g = gasto();
    $('restam').textContent = ORC - g; $('restam').style.color = g > ORC ? 'var(--nao)' : '';
    $('saldoTxt').textContent = 'dias livres · ' + (perfil.dias_ferias ?? 20) + ' de férias + ' + fds.length + ' feriados no fim de semana';
    const ocultos = new Set(perfil.feriados_ocultos || []);
    const escondida = t => ocultos.has(t.feriado) || (planos[t.id] && planos[t.id].status === 'agora-nao');
    let html = '';
    for (let m = 0; m < 12; m++) {
      if (ano === anoHoje && m < hoje.getMonth()) continue;
      const doMes = trips.filter(t => t.mes === m), vis = doMes.filter(t => !escondida(t));
      html += '<section class="mes"><h2>' + MESES[m] + ' <small>' + (vis.length ? vis.length + (vis.length > 1 ? ' escapadas' : ' escapada') : doMes.length ? 'escondida' : 'sem feriado') + '</small></h2>';
      vis.forEach((t, idx) => {
        const p = planos[t.id] || {}, L = p.duracao || t.padrao, o = t.opcoes[L], vou = p.status === 'vou';
        const durs = [3, 4, 5].concat(L > 5 ? [L] : []), cid = ideias(m, L, m + idx), am = amigosNaTrip(t.id);
        html += '<article class="trip' + (vou ? ' vou' : '') + '" data-id="' + t.id + '">' +
          '<div class="linha1"><div><div class="datas">' + fmt(o.inicio) + ' → ' + fmt(o.fim) + '</div><div class="sub">' + esc(t.feriado) + ' · ' + o.total + ' dias de viagem</div></div>' +
          '<div class="custo"><b' + (o.custo === 0 ? ' class="zero"' : '') + '>' + o.custo + (o.custo === 1 ? ' dia' : ' dias') + '</b><span class="sub">de férias</span></div></div>' +
          '<div class="sub">' + (o.tirar.length ? 'Pedir folga: ' + o.tirar.map(fmt).join(', ') : 'Não precisa pedir nenhum dia.') + '</div>' +
          '<div class="duracao">' + durs.map(d => '<button type="button" data-dur="' + d + '" aria-pressed="' + (d === L) + '">' + d + ' dias · gasta ' + t.opcoes[d].custo + '</button>').join('') +
            (L < 16 ? '<button type="button" data-dur="' + Math.max(6, L + 1) + '" aria-label="Esticar a viagem"><b>+</b></button>' : '') + '</div>' +
          (am ? '<div class="chips">' + am + '</div>' : '') +
          '<div class="form"><label for="c-' + t.id + '">Cidade que quero ir</label><input type="text" id="c-' + t.id + '" data-cidade value="' + esc(p.cidade || '') + '" placeholder="Escreva a cidade" autocomplete="off">' +
            (cid.length ? '<div class="chips"><span class="sub">Ideias novas:</span>' + cid.map(c => '<button type="button" class="chip" data-ideia="' + esc(c.nome) + '">' + bandeira(c.a2) + ' ' + esc(c.nome) + ' <span class="sub">' + esc(c.voo) + '</span></button>').join('') + '</div>' : '') + '</div>' +
          '<div class="acoes esq"><button type="button" class="ir" data-acao="vou">' + (vou ? '✓ Vou viajar' : 'Quero ir') + '</button>' +
            (vou ? '' : '<button type="button" class="leve" data-acao="agora-nao">Agora não</button><button type="button" class="leve" data-acao="ocultar">Não me interessa (todo ano)</button>') + '</div>' +
          (vou && p.cidade ? linksViagem(t, o, p) : vou ? '<div class="sub">Escreva a cidade para ver voos, hotéis e pôr na agenda.</div>' : '') +
          '</article>';
      });
      doMes.filter(escondida).forEach(t => {
        const sempre = ocultos.has(t.feriado), o = t.opcoes[(planos[t.id] || {}).duracao || t.padrao];
        html += '<div class="oculta"><span>' + esc(t.feriado) + ' · ' + fmt(o.inicio) + ' → ' + fmt(o.fim) + ' <small>(' + (sempre ? 'não me interessa' : 'agora não') + ')</small></span>' +
          '<button type="button" class="leve" ' + (sempre ? 'data-volta-sempre="' + esc(t.feriado) + '"' : 'data-volta="' + t.id + '"') + '>Mostrar de novo</button></div>';
      });
      if (!doMes.length) html += '<div class="generico">Sem feriado em dia útil. Tire uma sexta ou uma segunda e faça 3 dias gastando 1.</div>';
      html += '</section>';
    }
    $('lista').innerHTML = html;
  }
  $('anos').addEventListener('click', async ev => {
    const b = ev.target.closest('[data-ano]'); if (!b) return;
    ano = +b.dataset.ano; try { localStorage.setItem('tripsync:ano', ano); } catch (e) {}
    await carregarPlanos(); desenhar();
  });
  $('lista').addEventListener('click', ev => {
    const volta = ev.target.closest('[data-volta]'), voltaS = ev.target.closest('[data-volta-sempre]');
    if (volta) return salvarPlano(volta.dataset.volta, { status: null });
    if (voltaS) { salvarPerfil({ feriados_ocultos: (perfil.feriados_ocultos || []).filter(x => x !== voltaS.dataset.voltaSempre) }); return desenhar(); }
    const card = ev.target.closest('.trip'); if (!card) return;
    const id = card.dataset.id, t = F.cityTrips(ano).find(x => x.id === id), p = planos[id] || {};
    const dur = ev.target.closest('[data-dur]'), ideia = ev.target.closest('[data-ideia]'), acao = ev.target.closest('[data-acao]');
    if (dur) salvarPlano(id, { duracao: Math.min(16, +dur.dataset.dur) });
    else if (ideia) salvarPlano(id, { cidade: ideia.dataset.ideia, iata: null });
    else if (acao) {
      const a = acao.dataset.acao;
      if (a === 'vou') salvarPlano(id, { status: p.status === 'vou' ? null : 'vou' });
      if (a === 'agora-nao') salvarPlano(id, { status: 'agora-nao' });
      if (a === 'ocultar') { salvarPerfil({ feriados_ocultos: [...new Set([...(perfil.feriados_ocultos || []), t.feriado])] }); desenhar(); }
    }
  });
  $('lista').addEventListener('change', ev => {
    const inp = ev.target.closest('[data-cidade]'); if (!inp) return;
    salvarPlano(inp.closest('.trip').dataset.id, { cidade: inp.value.trim() || null, iata: null });
  });

  // ---------- Já fui ----------
  let mapaFeito = false;
  function desenharJaFui() {
    const pv = paisesVisitados();
    $('nPaises').textContent = pv.size; $('nPct').textContent = Math.round(pv.size / 195 * 100) + '%';
    $('nCidades').textContent = visitados.filter(v => v.cidade).length;
    const M = window.MAPA;
    if (M && !mapaFeito) {
      $('mapa').setAttribute('viewBox', '0 0 ' + M.w + ' ' + M.h);
      $('mapa').innerHTML = Object.entries(M.paises).map(([a, d]) => '<path class="p" data-a2="' + a + '" d="' + d + '"><title>' + esc(PAIS_NOME[a] || a) + '</title></path>').join('');
      mapaFeito = true;
    }
    $('mapa').querySelectorAll('path.p').forEach(p => p.classList.toggle('foi', pv.has(p.dataset.a2)));
    $('tituloLista').textContent = pv.size ? 'Seus países' : 'Onde você já foi? Marque os países';
    const q = norm($('buscaPais').value);
    const lista = (window.PAISES || []).filter(([a, n]) => !q || norm(n).includes(q)).sort((x, y) => (pv.has(y[0]) - pv.has(x[0])) || x[1].localeCompare(y[1], 'pt'));
    $('listaPaises').innerHTML = lista.map(([a, n]) => {
      const foi = pv.has(a), cs = visitados.filter(v => v.a2 === a && v.cidade);
      return '<li class="lp' + (foi ? ' foi' : '') + '"><div class="lp-top"><span class="bandeira" aria-hidden="true">' + bandeira(a) + '</span><span class="nome">' + esc(n) + '</span>' +
        '<button type="button" class="marca" data-marca="' + a + '" aria-pressed="' + foi + '">' + (foi ? '✓ Já fui' : 'Já fui') + '</button></div>' +
        (foi ? '<div class="lp-cid">' + cs.map(v => '<button type="button" class="tag-x" data-remove="' + v.id + '" aria-label="Remover ' + esc(v.cidade) + '">' + esc(v.cidade) + ' ×</button>').join('') +
          '<input type="text" data-add-cidade="' + a + '" placeholder="+ cidade" aria-label="Adicionar cidade em ' + esc(n) + '" autocomplete="off"></div>' : '') + '</li>';
    }).join('') || '<li class="sub">Nenhum país com esse nome.</li>';
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
    const cidade = inp.value.trim(), a = inp.dataset.addCidade; if (!cidade) return;
    if (visitados.some(v => v.a2 === a && norm(v.cidade) === norm(cidade))) { inp.value = ''; return; }
    const { data, error } = await sb.from('visitados').insert({ cidade, pais: PAIS_NOME[a] || a, a2: a }).select().single();
    if (error) { msg('appMsg', 'Não consegui salvar a cidade: ' + error.message, 'erro'); return; }
    visitados.push(data); desenhar();
    const novo = document.querySelector('[data-add-cidade="' + a + '"]'); if (novo) novo.focus();
  });

  // ---------- Amigos (grupos) ----------
  async function desenharGrupos() {
    $('meusGrupos').innerHTML = grupos.length ? grupos.map(g => '<div class="grupo"><button type="button" class="nome" data-grupo="' + g.id + '">' + esc(g.nome) + '</button>' +
      '<span class="sub">convite <span class="codigo">' + esc(g.codigo_convite) + '</span></span></div>').join('')
      : '<p class="sub">Crie um grupo e mande o código para seus amigos, ou entre num grupo com o código que alguém te mandou.</p>';
    if (!grupoAberto && grupos.length) grupoAberto = grupos[0].id;
    if (grupoAberto) await desenharGrupo(grupoAberto); else $('grupoDetalhe').innerHTML = '';
  }
  async function desenharGrupo(gid) {
    const g = grupos.find(x => x.id === gid); if (!g) return;
    const { data: mem } = await sb.from('grupo_membros').select('user_id,papel').eq('grupo_id', gid);
    const ids = (mem || []).map(m => m.user_id);
    const link = location.origin + location.pathname;
    const convite = 'Bora combinar viagem no Tripsync? Entra em ' + link + ', cria sua conta e usa o código ' + g.codigo_convite + ' na aba Amigos.';
    const trips = F.cityTrips(ano);
    const linhas = trips.map(t => {
      const doT = planosGrupo.filter(r => r.trip_id === t.id && ids.includes(r.user_id));
      const vao = doT.filter(r => r.status === 'vou'), nao = doT.filter(r => r.status === 'agora-nao').map(r => r.user_id);
      return { t, vao, nao };
    }).sort((a, b) => (b.vao.length - a.vao.length) || (a.nao.length - b.nao.length) || a.t.data.localeCompare(b.t.data));
    const nome = id => id === user.id ? 'Você' : ((perfisGrupo[id] || {}).nome || 'Alguém');
    const mini = id => { const p = perfisGrupo[id] || {}; return '<span class="mini" style="' + (p.foto_url ? 'background-image:url(&quot;' + esc(p.foto_url) + '&quot;)' : '') + '">' + (p.foto_url ? '' : esc(iniciais(p.nome))) + '</span>'; };
    $('grupoDetalhe').innerHTML = '<div class="cartao"><h3>' + esc(g.nome) + '</h3>' +
      '<div class="membros">' + ids.map(id => '<span class="membro">' + mini(id) + esc(nome(id)) + '</span>').join('') + '</div>' +
      '<div class="acoes esq"><button type="button" class="ir" data-convite="' + esc(convite) + '">Copiar convite</button><span class="sub">código <span class="codigo">' + esc(g.codigo_convite) + '</span></span>' +
      '<button type="button" class="leve" data-sair="' + g.id + '">Sair do grupo</button></div></div>' +
      '<h3>Escapadas de ' + ano + ' que mais servem ao grupo</h3>' + linhas.map(({ t, vao, nao }) => {
        const o = t.opcoes[t.padrao], livres = ids.filter(id => !vao.some(r => r.user_id === id) && !nao.includes(id));
        return '<div class="trip' + (vao.length > 1 ? ' vou' : '') + '"><div class="linha1"><div><div class="datas" style="font-size:18px">' + fmt(o.inicio) + ' → ' + fmt(o.fim) + '</div><div class="sub">' + esc(t.feriado) + ' · ' + o.total + ' dias, gasta ' + o.custo + '</div></div>' +
          '<div class="custo"><b>' + vao.length + '</b><span class="sub">' + (vao.length === 1 ? 'vai' : 'vão') + '</span></div></div><div class="chips">' +
          vao.map(r => '<span class="chip vou">' + esc(nome(r.user_id)) + ' vai' + (r.cidade ? ' · ' + esc(r.cidade) : '') + '</span>').join('') +
          livres.map(id => '<span class="chip">' + esc(nome(id)) + ' não decidiu</span>').join('') +
          nao.map(id => '<span class="chip nao">' + esc(nome(id)) + '</span>').join('') + '</div></div>';
      }).join('');
  }
  $('meusGrupos').addEventListener('click', ev => { const b = ev.target.closest('[data-grupo]'); if (b) { grupoAberto = b.dataset.grupo; desenharGrupo(grupoAberto); } });
  $('grupoDetalhe').addEventListener('click', async ev => {
    const c = ev.target.closest('[data-convite]'), s = ev.target.closest('[data-sair]');
    if (c) {
      const texto = c.dataset.convite;
      try { if (navigator.share) await navigator.share({ text: texto }); else { await navigator.clipboard.writeText(texto); c.textContent = 'Copiado ✓'; } }
      catch (e) { try { await navigator.clipboard.writeText(texto); c.textContent = 'Copiado ✓'; } catch (e2) { prompt('Copie o convite:', texto); } }
    }
    if (s) {
      if (!confirm('Sair deste grupo?')) return;
      await sb.from('grupo_membros').delete().eq('grupo_id', s.dataset.sair).eq('user_id', user.id);
      grupos = grupos.filter(g => g.id !== s.dataset.sair); grupoAberto = null; desenharGrupos();
    }
  });
  $('formCriarGrupo').addEventListener('submit', async ev => {
    ev.preventDefault();
    const { data, error } = await sb.rpc('criar_grupo', { p_nome: $('gNome').value.trim() });
    if (error) return msg('appMsg', 'Não consegui criar o grupo: ' + error.message, 'erro');
    $('gNome').value = ''; grupos.push(data); grupoAberto = data.id; msg('appMsg', 'Grupo criado. Copie o convite e mande para seus amigos.', 'ok'); desenharGrupos();
  });
  $('formEntrarGrupo').addEventListener('submit', async ev => {
    ev.preventDefault();
    const { data, error } = await sb.rpc('entrar_no_grupo', { p_codigo: $('gCodigo').value.trim() });
    if (error) return msg('appMsg', /inválido/.test(error.message) ? 'Código não encontrado. Confira as 6 letras.' : 'Não consegui entrar: ' + error.message, 'erro');
    $('gCodigo').value = '';
    if (!grupos.some(g => g.id === data.id)) grupos.push(data);
    grupoAberto = data.id; await carregarPlanos(); await carregarPerfisGrupo();
    msg('appMsg', 'Você entrou em ' + data.nome + '.', 'ok'); desenharGrupos();
  });

  // ---------- Perfil ----------
  function desenharPerfil() {
    $('pNome').value = perfil.nome || ''; $('pTel').value = perfil.telefone || ''; $('pNasc').value = perfil.data_nascimento || '';
    $('pCidade').value = perfil.cidade_base || ''; $('pDias').value = perfil.dias_ferias ?? 20; $('pEmail').textContent = user.email;
    const f = $('fotoPrev');
    if (perfil.foto_url) { f.style.backgroundImage = 'url("' + perfil.foto_url + '")'; f.textContent = ''; } else { f.style.backgroundImage = ''; f.textContent = iniciais(perfil.nome); }
  }
  $('formPerfil').addEventListener('submit', async ev => {
    ev.preventDefault();
    const ok = await salvarPerfil({ nome: $('pNome').value.trim() || null, telefone: $('pTel').value.trim() || null, data_nascimento: $('pNasc').value || null,
      cidade_base: $('pCidade').value.trim() || null, dias_ferias: Math.max(0, Math.min(60, +$('pDias').value || 0)) });
    msg('pMsg', ok ? 'Perfil salvo.' : 'Não consegui salvar.', ok ? 'ok' : 'erro'); desenhar();
  });
  $('pFoto').addEventListener('change', async () => {
    const file = $('pFoto').files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) return msg('pMsg', 'A foto precisa ter menos de 5 MB.', 'erro');
    msg('pMsg', 'Enviando foto…');
    const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg'), caminho = user.id + '/avatar-' + Date.now() + '.' + ext;
    const { error } = await sb.storage.from('avatars').upload(caminho, file, { upsert: true, contentType: file.type });
    if (error) return msg('pMsg', 'Não consegui enviar a foto: ' + error.message, 'erro');
    const url = sb.storage.from('avatars').getPublicUrl(caminho).data.publicUrl;
    const ok = await salvarPerfil({ foto_url: url });
    msg('pMsg', ok ? 'Foto atualizada.' : 'Não consegui salvar a foto.', ok ? 'ok' : 'erro'); desenhar();
  });

  // PWA: funciona offline para abrir o app
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
