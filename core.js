/* Núcleo do otimizador (sem interface). Reutilizável no futuro app.
   Módulos futuros (voos, hospedagem, roteiro) devem consumir os "blocos" gerados aqui. */
(function (root) {
  const DAY = 86400000;
  const utc = (y, m, d) => Date.UTC(y, m, d);
  const iso = t => new Date(t).toISOString().slice(0, 10);
  const dow = t => new Date(t).getUTCDay(); // 0=dom

  function easter(y) { // algoritmo anônimo gregoriano
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4,
      f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return utc(y, month - 1, day);
  }

  // Os 10 feriados legais da Bélgica
  function feriadosBelgica(y) {
    const p = easter(y);
    return [
      [utc(y, 0, 1), 'Ano Novo'],
      [p + 1 * DAY, 'Segunda-feira de Páscoa'],
      [utc(y, 4, 1), 'Dia do Trabalho'],
      [p + 39 * DAY, 'Ascensão'],
      [p + 50 * DAY, 'Segunda-feira de Pentecostes'],
      [utc(y, 6, 21), 'Dia Nacional'],
      [utc(y, 7, 15), 'Assunção'],
      [utc(y, 10, 1), 'Todos os Santos'],
      [utc(y, 10, 11), 'Armistício'],
      [utc(y, 11, 25), 'Natal'],
    ].map(([t, nome]) => ({ data: iso(t), t, nome, fimDeSemana: dow(t) === 0 || dow(t) === 6 }));
  }

  // Fonte de feriados trocável: por padrão Bélgica; o app troca pelo país da pessoa.
  // fn(y) devolve [[data ISO, nome], ...] ou o formato de feriadosBelgica.
  let fonte = null;
  function usarFeriados(fn) { fonte = fn; cache.clear(); }
  function feriados(y) {
    if (!fonte) return feriadosBelgica(y).map(h => Object.assign({ id: h.nome }, h));
    // [data, nome no idioma, chave estável] — a chave não muda quando a pessoa troca o idioma
    return (fonte(y) || []).map(h => {
      if (!Array.isArray(h)) return Object.assign({ id: h.nome }, h);
      const t = Date.parse(h[0] + 'T00:00:00Z');
      return { data: h[0], t, nome: h[1], id: h[2] || h[1], fimDeSemana: dow(t) === 0 || dow(t) === 6 };
    });
  }

  // Dias do ano Y (+ começo de janeiro de Y+1 para pontes de fim de ano)
  function montarDias(y) {
    const hol = new Map();
    [...feriados(y), ...feriados(y + 1)].forEach(h => { if (!hol.has(h.data)) hol.set(h.data, h); });
    const dias = [];
    for (let t = utc(y, 0, 1); t <= utc(y + 1, 0, 10); t += DAY) {
      const d = iso(t), w = dow(t), fds = w === 0 || w === 6, h = hol.get(d), feriado = h ? h.nome : null;
      dias.push({ t, data: d, dow: w, fds, feriado, feriadoId: h ? h.id : null, util: !fds && !feriado, noAno: t < utc(y + 1, 0, 1) });
    }
    return dias;
  }

  // Todos os blocos possíveis: um trecho de dias úteis tirados + folgas coladas dos dois lados
  function candidatos(dias, maxCusto) {
    const out = [];
    for (let a = 0; a < dias.length; a++) {
      if (!dias[a].util || !dias[a].noAno) continue;
      let custo = 0, temFeriado = false;
      for (let b = a; b < dias.length && dias[b].noAno; b++) {
        if (dias[b].util) custo++;
        if (dias[b].feriado && !dias[b].fds) temFeriado = true;
        if (custo > maxCusto) break;
        if (!dias[b].util) continue; // b sempre termina num dia tirado
        let s = a, e = b;
        while (s > 0 && !dias[s - 1].util) s--;
        while (e < dias.length - 1 && !dias[e + 1].util) e++;
        let hol = temFeriado;
        for (let i = s; i <= e; i++) if (dias[i].feriado && !dias[i].fds) hol = true;
        const total = e - s + 1;
        out.push({ s, e, a, b, custo, total, temFeriado: hol, razao: total / custo });
      }
    }
    return out;
  }

  /* Escolhe blocos sem sobreposição que maximizam os dias de folga totais,
     gastando no máximo `orcamento` dias. Opcional: exigir 1 bloco com >= `viagemLonga` dias seguidos.
     Programação dinâmica sobre blocos ordenados pelo fim. */
  function otimizar(y, orcamento, viagemLonga, minRazao, mesLonga, guardar) {
    const dias = montarDias(y);
    const todos = candidatos(dias, orcamento);
    const noMes = c => mesLonga == null || mesLonga < 0 ||
      [c.s, c.e].some(i => new Date(dias[i].t).getUTCMonth() === mesLonga && dias[i].noAno) ||
      (new Date(dias[c.s].t).getUTCMonth() < mesLonga && new Date(dias[c.e].t).getUTCMonth() > mesLonga);
    const ehLonga = c => viagemLonga > 0 && c.total >= viagemLonga && noMes(c);
    // Pontes: blocos com feriado que rendem >= minRazao dias de folga por dia gasto.
    // Viagem longa: qualquer bloco com >= viagemLonga dias seguidos.
    const cands = todos.filter(c => (c.temFeriado && c.razao >= (minRazao || 2) - 1e-9) ||
      ehLonga(c)).sort((x, z) => x.e - z.e);
    const n = cands.length, B = orcamento, F = viagemLonga > 0 ? 2 : 1;
    // p[j] = último candidato que termina antes do início de j
    const ends = cands.map(c => c.e);
    const p = cands.map(c => { let lo = 0, hi = n - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (ends[m] < c.s) { r = m; lo = m + 1; } else hi = m - 1; } return r; });
    const NEG = -1e9, W = (B + 1) * F;
    const dp = new Float64Array((n + 1) * W).fill(NEG);
    const idx = (j, b, f) => j * W + b * F + f;
    for (let b = 0; b <= B; b++) dp[idx(0, b, 0)] = 0;
    // pequeno bônus por eficiência como desempate (prefere menos blocos ineficientes)
    for (let j = 1; j <= n; j++) {
      const c = cands[j - 1], longo = ehLonga(c) ? 1 : 0;
      const soLonga = !(c.temFeriado && c.razao >= (minRazao || 2) - 1e-9);
      for (let b = 0; b <= B; b++) for (let f = 0; f < F; f++) {
        let best = dp[idx(j - 1, b, f)];
        if (c.custo <= b && !(soLonga && !(longo && f === 1))) {
          const val = c.total + 0.001 * c.razao;
          const fs = longo ? [f, 0].filter((v, i, a) => a.indexOf(v) === i) : [f];
          for (const pf of (soLonga ? [0] : longo && f === 1 ? [0, 1] : fs)) {
            const prev = dp[idx(p[j - 1] + 1, b - c.custo, pf)];
            if (prev > NEG / 2 && prev + val > best) best = prev + val;
          }
        }
        dp[idx(j, b, f)] = best;
      }
    }
    // reconstrução
    const fFinal = F - 1;
    let bBest = 0;
    // Com `guardar`, dia não gasto vale um pouco menos que a ponte mínima aceita: guarda dias em vez de gastá-los em blocos comuns
    const VALOR_LIVRE = guardar ? Math.min(1.9, (minRazao || 2) - 0.05) : 0;
    const score = b => dp[idx(n, b, fFinal)] + VALOR_LIVRE * (B - b);
    for (let b = 0; b <= B; b++) if (score(b) > score(bBest) + 1e-9) bBest = b;
    const escolhidos = [];
    let j = n, b = bBest, f = fFinal;
    if (dp[idx(n, b, f)] < NEG / 2) return null;
    while (j > 0) {
      if (Math.abs(dp[idx(j, b, f)] - dp[idx(j - 1, b, f)]) < 1e-9) { j--; continue; }
      const c = cands[j - 1], longo = ehLonga(c) ? 1 : 0;
      const val = c.total + 0.001 * c.razao;
      const soLonga = !(c.temFeriado && c.razao >= (minRazao || 2) - 1e-9);
      const opts = soLonga ? [0] : longo && f === 1 ? [0, 1] : [f];
      let ok = false;
      for (const pf of opts) {
        const prev = dp[idx(p[j - 1] + 1, b - c.custo, pf)];
        if (prev > NEG / 2 && Math.abs(prev + val - dp[idx(j, b, f)]) < 1e-9) {
          escolhidos.push(c); b -= c.custo; f = pf; j = p[j - 1] + 1; ok = true; break;
        }
      }
      if (!ok) j--;
    }
    escolhidos.reverse();
    const blocos = escolhidos.map(c => bloco(dias, c));
    blocos.forEach(x => { x.viagemLonga = viagemLonga > 0 && x.total >= viagemLonga; });
    return {
      ano: y, dias, blocos, orcamento,
      diasGastos: blocos.reduce((s, x) => s + x.custo, 0),
      diasFolga: blocos.reduce((s, x) => s + x.total, 0),
      diasLivres: orcamento - blocos.reduce((s, x) => s + x.custo, 0),
      melhoresPontes: melhoresPontes(dias, todos),
    };
  }

  function bloco(dias, c) {
    const tirar = [];
    for (let i = c.a; i <= c.b; i++) if (dias[i].util) tirar.push(dias[i].data);
    const feriados = [];
    for (let i = c.s; i <= c.e; i++) if (dias[i].feriado) feriados.push(dias[i].feriado);
    return { inicio: dias[c.s].data, fim: dias[c.e].data, tirar, custo: c.custo, total: c.total,
      razao: c.razao, feriados, temFeriado: c.temFeriado };
  }

  // Ranking: para cada feriado útil, a ponte mais eficiente (custo 1-4)
  function melhoresPontes(dias, cands) {
    const best = new Map();
    for (const c of cands) {
      if (!c.temFeriado || c.custo > 4 || !dias[c.s].noAno) continue;
      let key = null;
      for (let i = c.s; i <= c.e; i++) if (dias[i].feriado && !dias[i].fds) { key = dias[i].data; break; }
      const cur = best.get(key);
      if (!cur || c.razao > cur.razao + 1e-9 || (Math.abs(c.razao - cur.razao) < 1e-9 && c.total > cur.total)) best.set(key, c);
    }
    return [...best.values()].sort((x, z) => z.razao - x.razao || z.total - x.total).map(c => bloco(dias, c));
  }


  /* City trips: para cada feriado em dia útil, a janela de L dias seguidos (que contém o feriado)
     que gasta menos dias de férias. Sugere L entre 3 e 5; o usuário pode esticar até 16. */
  function melhorJanela(dias, i, L) {
    let best = null;
    for (let s = Math.max(0, i - L + 1); s <= i && s + L - 1 < dias.length; s++) {
      let custo = 0, fds = 0;
      for (let k = s; k < s + L; k++) { if (dias[k].util) custo++; if (dias[k].fds) fds++; }
      // desempate: mais fim de semana dentro, depois começar mais cedo
      if (!best || custo < best.custo || (custo === best.custo && fds > best.fds)) best = { s, e: s + L - 1, custo, fds };
    }
    return best;
  }

  const cache = new Map();
  function cityTrips(y) {
    if (!cache.has(y)) cache.set(y, calcCityTrips(y));
    return cache.get(y);
  }
  function calcCityTrips(y) {
    const dias = montarDias(y);
    const out = [];
    dias.forEach((d, i) => {
      if (!d.noAno || !d.feriado || d.fds) return;
      const opcoes = {};
      for (let L = 3; L <= 16; L++) {
        const w = melhorJanela(dias, i, L);
        if (w) opcoes[L] = janela(dias, w);
      }
      // padrão: a mais longa entre 3-5 que ainda custa o mínimo possível por dia de folga
      let padrao = 3, bestScore = -1;
      for (let L = 3; L <= 5; L++) {
        const o = opcoes[L]; if (!o) continue;
        const score = o.custo === 0 ? 100 + L : L / o.custo;
        if (score > bestScore + 1e-9) { bestScore = score; padrao = L; }
      }
      out.push({ id: d.data, feriado: d.feriado, chave: d.feriadoId, data: d.data, mes: new Date(d.t).getUTCMonth(), padrao, opcoes });
    });
    return out;
  }

  function janela(dias, w) {
    const tirar = [], feriados = [];
    for (let k = w.s; k <= w.e; k++) { if (dias[k].util) tirar.push(dias[k].data); if (dias[k].feriado) feriados.push(dias[k].feriado); }
    return { inicio: dias[w.s].data, fim: dias[w.e].data, total: w.e - w.s + 1, custo: w.custo, tirar, feriados };
  }

  root.Ferias = { cityTrips, feriados, usarFeriados, feriadosBelgica, montarDias, candidatos, otimizar, easter, iso };
})(typeof window !== 'undefined' ? window : globalThis);
