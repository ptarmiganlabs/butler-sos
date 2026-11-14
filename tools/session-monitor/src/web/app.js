/* Sense sessions: live view. Plain JavaScript, no dependencies. All text from the server is
   inserted with textContent, never as HTML. */
(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const el = (tag, cls, text) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
    };
    const SVG = 'http://www.w3.org/2000/svg';
    const svg = (tag, attrs = {}, cls) => {
        const e = document.createElementNS(SVG, tag);
        for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
        if (cls) e.setAttribute('class', cls);
        return e;
    };
    const store = {
        get(k, d) {
            try {
                return localStorage.getItem(k) ?? d;
            } catch {
                return d;
            }
        },
        set(k, v) {
            try {
                localStorage.setItem(k, v);
            } catch {
                /* private window: preferences just aren't remembered */
            }
        },
    };

    let state = null;
    let offset = 0; // server clock minus browser clock
    let lastMessage = 0;
    const open = new Set(JSON.parse(store.get('sm.open', '[]')));
    const userEls = new Map();
    const seenEvents = new Set();
    let feedItems = [];

    const now = () => Date.now() + offset;
    const t = (iso) => (iso ? Date.parse(iso) : null);
    const pad = (n) => String(n).padStart(2, '0');
    const clock = (ms) => {
        const d = new Date(ms);
        return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    const clockS = (ms) => `${clock(ms)}:${pad(new Date(ms).getSeconds())}`;
    const dur = (ms) => {
        const s = Math.max(0, Math.ceil(ms / 1000));
        if (s >= 3600) return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
        return `${Math.floor(s / 60)}:${pad(s % 60)}`;
    };
    const ago = (ms) => {
        const s = Math.max(0, Math.round((now() - ms) / 1000));
        if (s < 5) return 'just now';
        if (s < 60) return `${s} s ago`;
        if (s < 3600) return `${Math.floor(s / 60)} min ago`;
        return clock(ms);
    };
    const who = (u) => `${u.userDirectory}\\${u.userId}`;
    const initials = (id) => {
        const parts = String(id)
            .split(/[.\-_\s@]+/)
            .filter(Boolean);
        if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
        const digits = String(id).match(/\d+$/);
        if (digits) return (String(id)[0] + digits[0].slice(-2)).toUpperCase();
        return String(id)
            .replace(/[^a-z0-9]/gi, '')
            .slice(0, 2)
            .toUpperCase();
    };
    const licenceName = (l) =>
        l === 'professional'
            ? 'Professional'
            : l === 'analyzer'
              ? 'Analyzer'
              : 'No licence allocation';
    const vpName = (vp) => (vp == null ? '—' : vp === '/' ? '/ (default)' : `/${vp}`);

    /* ---------- preferences: layout and theme ---------- */
    const params = new URLSearchParams(location.search);
    let mode = params.get('mode') || store.get('sm.mode', 'desk');
    let theme = params.get('theme') || store.get('sm.theme', '');
    function applyMode() {
        document.body.classList.toggle('wall', mode === 'wall');
        for (const b of document.querySelectorAll('.seg button'))
            b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
        if (state) render();
    }
    function applyTheme() {
        if (theme) document.documentElement.dataset.theme = theme;
        else delete document.documentElement.dataset.theme;
    }
    for (const b of document.querySelectorAll('.seg button')) {
        b.addEventListener('click', () => {
            mode = b.dataset.mode;
            store.set('sm.mode', mode);
            applyMode();
        });
    }
    $('theme').addEventListener('click', () => {
        const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
        theme = dark ? 'light' : 'dark';
        store.set('sm.theme', theme);
        applyTheme();
    });
    $('search').addEventListener('input', () => {
        pageLimit = PAGE;
        if (state) renderUsers();
    });
    $('showUnlicensed').checked = store.get('sm.unlicensed', '0') === '1';
    $('showUnlicensed').addEventListener('change', (e) => {
        store.set('sm.unlicensed', e.target.checked ? '1' : '0');
        if (state) {
            renderChips();
            renderUsers();
        }
    });
    applyTheme();
    applyMode();

    /* ---------- live per-user numbers, recomputed every second ---------- */
    function liveSlots(u) {
        const n = now();
        return (u.slotsFreeAt || [])
            .map(t)
            .filter((x) => x > n)
            .sort((a, b) => a - b);
    }
    function levelOf(count) {
        const c = state.config;
        return count >= c.criticalAt ? 'critical' : count >= c.warnAt ? 'warn' : 'ok';
    }

    /* ---------- KPIs ---------- */
    // Built once, then only their text changes, so help buttons and their tooltips stay put.
    const helpButton = (topic, tip, label, cls = '') => {
        const b = el('button', `help ${cls}`, '?');
        b.type = 'button';
        b.dataset.help = topic;
        b.dataset.tip = tip;
        b.setAttribute('aria-label', `Help: ${label}`);
        return b;
    };
    const KPIS = [
        [
            'limit',
            'At the limit',
            'levels',
            'Users with all their slots taken. Their next new session will be refused.',
            'tip-right',
        ],
        [
            'warn',
            'One slot left',
            'levels',
            'Users who can start one more session, and no more, right now.',
        ],
        [
            'users',
            'Connected users',
            'levels',
            'Licensed users with at least one open session, and how many slots they hold in total.',
        ],
        [
            'proxy',
            'Proxy sessions',
            'proxy',
            'Every session the Qlik proxy has open, refused ones and service accounts included. Not the same as slots.',
        ],
        [
            'refused',
            'Refused sessions',
            'refused',
            'New sessions turned away because the user had no free slot, since the monitor started.',
        ],
    ];
    const kpiEls = {};
    let licBody = null;
    function buildKpis() {
        const box = $('kpis');
        for (const [key, label, topic, tip, cls] of KPIS) {
            const k = el('div', 'kpi');
            const lab = el('div', 'label', label);
            lab.append(helpButton(topic, tip, label, cls));
            const value = el('div', 'value', '–');
            const sub = el('div', 'sub', '');
            k.append(lab, value, sub);
            kpiEls[key] = { k, value, sub };
            box.append(k);
        }
        const lic = el('div', 'kpi lic');
        const lab = el('div', 'label', 'Licences on the site');
        lab.append(
            helpButton(
                'licences',
                'Allocated, in use and total licences, as the QMC shows them.',
                'licences on the site',
                'tip-left'
            )
        );
        licBody = el('div', 'lic-body');
        lic.append(lab, licBody);
        box.append(lic);
    }
    function setKpi(key, value, sub, cls) {
        const x = kpiEls[key];
        x.value.textContent = String(value);
        x.sub.textContent = sub;
        x.k.className = `kpi ${cls || ''}`;
    }
    function meter(name, used, allocated, total, text) {
        const m = el('div', 'meter');
        const bar = el('div', 'bar');
        const a = el('i', 'alloc');
        a.style.width = `${total ? Math.min(100, (allocated / total) * 100) : 0}%`;
        const u = el('i', 'used');
        u.style.width = `${total ? Math.min(100, (used / total) * 100) : 0}%`;
        bar.append(a, u);
        const num = el('span', 'm-num');
        num.append(document.createTextNode(text[0]), el('small', null, text[1]));
        m.append(el('span', 'm-name', name), bar, num);
        return m;
    }
    function renderKpis() {
        if (!licBody) buildKpis();
        const users = visibleLicensedUsers();
        let crit = 0;
        let warn = 0;
        let slots = 0;
        for (const u of users) {
            const c = liveSlots(u).length;
            slots += c;
            if (levelOf(c) === 'critical') crit++;
            else if (levelOf(c) === 'warn') warn++;
        }
        const s = state.summary;
        const vpCount = Object.keys(state.breakdown?.virtualProxies || {}).length;
        const connected = users.filter((u) => u.proxySessions > 0).length;
        const lim = state.config.slotsLimit;
        if (licencesUnknown()) {
            setKpi('limit', '–', 'licence data not read yet');
            setKpi('warn', '–', 'licence data not read yet');
        } else {
            setKpi(
                'limit',
                crit,
                `${crit === 1 ? 'user has' : 'users have'} all ${lim} slots taken`,
                crit ? 'alarm' : ''
            );
            setKpi(
                'warn',
                warn,
                `${warn === 1 ? 'user is' : 'users are'} one session from the limit`,
                warn ? 'caution' : ''
            );
        }
        setKpi('users', connected, `holding ${slots} licence slot${slots === 1 ? '' : 's'}`);
        setKpi(
            'proxy',
            s.proxySessions,
            `on ${vpCount} virtual prox${vpCount === 1 ? 'y' : 'ies'}`
        );
        setKpi(
            'refused',
            s.refusedSinceStart,
            `since ${clock(t(state.startedAt))}`,
            s.refusedSinceStart ? 'caution' : ''
        );
    }
    function renderLicences() {
        if (!licBody) buildKpis();
        const L = state.licences;
        const parts = [];
        if (!L) parts.push(el('div', 'sub', 'Not read yet.'));
        else {
            for (const [name, a] of [
                ['Professional', L.professional],
                ['Analyzer', L.analyzer],
            ]) {
                if (a)
                    parts.push(
                        meter(name, a.used, a.allocated, a.total, [
                            `${a.allocated} / ${a.total}`,
                            ` allocated · ${a.used} in use`,
                        ])
                    );
            }
            if (L.analyzerTime) {
                const at = L.analyzerTime;
                parts.push(
                    meter('Analyzer time', at.usedMinutes, at.usedMinutes, at.allocatedMinutes, [
                        `${at.usedMinutes} / ${at.allocatedMinutes}`,
                        ' minutes used',
                    ])
                );
            }
            if (L.tokens)
                parts.push(
                    el('div', 'sub', `Tokens: ${L.tokens.available} of ${L.tokens.total} available`)
                );
        }
        licBody.replaceChildren(...parts);
    }

    /* ---------- help: tooltips on hover, a dialog on click ---------- */
    const dialog = $('helpDialog');
    function cfgValue(name) {
        const c = state?.config || {
            slotsLimit: 5,
            windowSeconds: 360,
            warnAt: 4,
            timelineMinutes: 30,
        };
        return {
            slotsLimit: c.slotsLimit,
            windowMinutes: c.windowSeconds / 60,
            warnAt: c.warnAt,
            timelineMinutes: c.timelineMinutes,
            pollSeconds: state?.pollSeconds ?? 15,
            graceSeconds: c.refusalGraceSeconds ?? 20,
            licenceSeconds: c.licenceOverviewSeconds ?? 60,
        }[name];
    }
    function openHelp(topic) {
        const tpl = $(`help-${topic}`);
        if (!tpl) return;
        $('helpTitle').textContent = tpl.dataset.title;
        const body = tpl.content.cloneNode(true);
        for (const span of body.querySelectorAll('[data-cfg]')) {
            const v = cfgValue(span.dataset.cfg);
            if (v != null) span.textContent = String(v);
        }
        $('helpBody').replaceChildren(body);
        $('helpBody').scrollTop = 0;
        $('helpMore').textContent =
            topic === 'about' ? '' : 'Every ? on the page explains the part next to it.';
        dialog.showModal();
    }
    document.addEventListener('click', (e) => {
        const b = e.target.closest('.help');
        if (!b) return;
        e.preventDefault();
        e.stopPropagation();
        openHelp(b.dataset.help);
    });
    for (const b of dialog.querySelectorAll('.hd-close, .hd-ok'))
        b.addEventListener('click', () => dialog.close());
    // A click on the dimmed backdrop (outside the dialog box) closes it.
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.close();
    });

    /* ---------- users: who to show, in what order ---------- */
    const PAGE = 50;
    const WALL_TILES = 24;
    const ATTENTION_MS = 15 * 60000; // a refusal keeps a user "needing attention" this long
    // Chip filters are remembered between visits; a clicked chart bar is not (it's a quick look).
    let filter = store.get('sm.filter', 'all');
    if (filter.startsWith('slots:')) filter = 'all';
    let sortBy = store.get('sm.sort', 'slots');
    let pageLimit = PAGE;
    $('sort').value = sortBy;
    $('sort').addEventListener('change', (e) => {
        sortBy = e.target.value;
        store.set('sm.sort', sortBy);
        renderUsers();
    });
    $('clearFilter').addEventListener('click', () => {
        $('search').value = '';
        setFilter('all');
    });
    $('more').addEventListener('click', () => {
        pageLimit += PAGE;
        renderUsers();
    });
    function setFilter(f) {
        filter = filter === f && f !== 'all' ? 'all' : f;
        store.set('sm.filter', filter.startsWith('slots:') ? 'all' : filter);
        pageLimit = PAGE;
        renderDist();
        renderChips();
        renderUsers();
    }

    // Until licences have been read once, no one can be told apart as unlicensed: list everyone.
    const licencesUnknown = () => !!state.summary.licencesUnknown;
    function visibleLicensedUsers() {
        return state.users.filter(
            (u) => !u.gone && (u.licence || u.slotsUsed || licencesUnknown())
        );
    }
    const refusedRecently = (u) => u.lastRefusedAt && now() - t(u.lastRefusedAt) < ATTENTION_MS;
    function needsAttention(u) {
        return levelOf(liveSlots(u).length) !== 'ok' || refusedRecently(u);
    }
    const FILTERS = [
        ['all', 'All'],
        ['attention', 'Needs attention'],
        ['critical', 'At the limit'],
        ['warn', 'One slot left'],
        ['refused', 'Refused, last 15 min'],
    ];
    function matches(u, f) {
        const n = liveSlots(u).length;
        if (f === 'all') return true;
        if (f === 'attention') return needsAttention(u);
        if (f === 'critical') return levelOf(n) === 'critical';
        if (f === 'warn') return levelOf(n) === 'warn';
        if (f === 'refused') return !!refusedRecently(u);
        if (f.startsWith('slots:')) {
            const k = Number(f.slice(6));
            return k >= state.config.slotsLimit ? n >= k : n === k;
        }
        return true;
    }
    function sorted(list) {
        const key = {
            slots: (u) => [-liveSlots(u).length, -(u.refusedTotal || 0), -u.proxySessions],
            sessions: (u) => [-u.proxySessions, -liveSlots(u).length],
            refused: (u) => [-(u.refusedTotal || 0), -liveSlots(u).length],
            name: () => [],
        }[sortBy];
        return list
            .map((u) => [key(u), u])
            .sort((a, b) => {
                for (let i = 0; i < a[0].length; i++)
                    if (a[0][i] !== b[0][i]) return a[0][i] - b[0][i];
                return a[1].key.localeCompare(b[1].key);
            })
            .map(([, u]) => u);
    }
    // Everyone who could be listed: licensed users, and accounts without a licence if switched on.
    function candidates() {
        const showUnlicensed =
            ($('showUnlicensed').checked && mode !== 'wall') || licencesUnknown();
        return state.users.filter((u) => !u.gone && (u.licence || u.slotsUsed || showUnlicensed));
    }
    function shownUsers() {
        if (mode === 'wall') return sorted(candidates().filter(needsAttention));
        const q = $('search').value.trim().toLowerCase();
        return sorted(
            candidates().filter(
                (u) => matches(u, filter) && (!q || who(u).toLowerCase().includes(q))
            )
        );
    }

    /* ---------- distribution and filter chips ---------- */
    function renderDist() {
        const box = $('dist');
        const lim = state.config.slotsLimit;
        const counts = Array(lim + 1).fill(0);
        for (const u of visibleLicensedUsers()) {
            if (!u.proxySessions && !u.slotsUsed) continue;
            counts[Math.min(lim, liveSlots(u).length)]++;
        }
        // Square-root heights: on a large site the few users at 4 or 5 slots would otherwise be invisible
        // next to the hundreds at 1. The exact counts are printed above each bar.
        const max = Math.sqrt(Math.max(1, ...counts));
        if (box.children.length !== lim + 1) {
            box.replaceChildren();
            for (let k = 0; k <= lim; k++) {
                const b = el('button', 'dbar');
                b.type = 'button';
                b.dataset.k = String(k);
                b.append(el('span', 'dcount'), el('span', 'dcol'), el('span', 'dlab'));
                b.addEventListener('click', () => mode !== 'wall' && setFilter(`slots:${k}`));
                box.append(b);
            }
        }
        [...box.children].forEach((b, k) => {
            const level = k === 0 ? 'zero' : levelOf(k);
            b.className = `dbar ${level}${filter === `slots:${k}` ? ' active' : ''}`;
            b.querySelector('.dcount').textContent = String(counts[k]);
            b.querySelector('.dcol').style.height =
                `${counts[k] ? Math.max(4, (Math.sqrt(counts[k]) / max) * 100) : 0}%`;
            b.querySelector('.dlab').textContent =
                k === 0 ? '0 slots' : k === lim ? `${k}` : String(k);
            b.setAttribute(
                'aria-label',
                `${counts[k]} users with ${k} slot${k === 1 ? '' : 's'} in use`
            );
            b.title = `${counts[k]} user${counts[k] === 1 ? '' : 's'} with ${k} slot${k === 1 ? '' : 's'} in use. Click to list them.`;
        });
    }
    function renderChips() {
        const box = $('chips');
        const all = candidates();
        if (!box.children.length) {
            for (const [f, label] of FILTERS) {
                const b = el('button', 'fchip');
                b.type = 'button';
                b.dataset.f = f;
                b.append(el('span', null, label), el('b'));
                b.addEventListener('click', () => setFilter(f));
                box.append(b);
            }
        }
        for (const b of box.children) {
            const f = b.dataset.f;
            const n = all.filter((u) => matches(u, f)).length;
            b.querySelector('b').textContent = String(n);
            b.classList.toggle('active', filter === f);
            b.classList.toggle('alarm', (f === 'critical' || f === 'refused') && n > 0);
            b.classList.toggle('caution', (f === 'warn' || f === 'attention') && n > 0);
        }
    }

    function buildUser(u) {
        const node = $('tplUser').content.firstElementChild.cloneNode(true);
        const row = node.querySelector('.user-row');
        row.addEventListener('click', () => {
            if (mode === 'wall') return;
            const key = node.dataset.key;
            if (open.has(key)) open.delete(key);
            else open.add(key);
            store.set('sm.open', JSON.stringify([...open]));
            updateOpen(node);
        });
        node.dataset.key = u.key;
        return node;
    }
    function updateOpen(node) {
        const isOpen = open.has(node.dataset.key) && mode !== 'wall';
        node.classList.toggle('open', isOpen);
        node.querySelector('.user-row').setAttribute('aria-expanded', String(isOpen));
        node.querySelector('.detail').hidden = !isOpen;
        if (isOpen) {
            drawTimeline(node);
            fetchTimeline(node);
        }
    }

    function fillUser(node, u) {
        node._u = u;
        node.querySelector('.avatar').textContent = initials(u.userId);
        node.querySelector('.name').textContent = u.userId;
        node.querySelector('.dir').textContent = '';
        node.querySelector('.lic').textContent =
            `${u.userDirectory} · ${licencesUnknown() && !u.licence ? 'licence not read yet' : licenceName(u.licence)}`;
        node.querySelector('.who').title = who(u);
        const vps = node.querySelector('.vps');
        vps.replaceChildren();
        for (const [vp, n] of Object.entries(u.byVirtualProxy).sort((a, b) => b[1] - a[1])) {
            const c = el('span', 'chip');
            c.title = `${n} proxy session${n === 1 ? '' : 's'} on ${vpName(vp)}`;
            c.append(document.createTextNode(vpName(vp)), el('b', null, String(n)));
            vps.append(c);
        }
        if (!Object.keys(u.byVirtualProxy).length)
            vps.append(el('span', 'chip', 'no open proxy session'));
        node.querySelector('.refused').textContent = u.refusedTotal
            ? `${u.refusedTotal} refused`
            : '';
        tickUser(node);
    }

    function tickUser(node) {
        const u = node._u;
        const limit = state.config.slotsLimit;
        const win = state.config.windowSeconds * 1000;
        const slots = liveSlots(u);
        const level = levelOf(slots.length);
        node.classList.remove('ok', 'warn', 'critical');
        node.classList.add(level);
        const pips = node.querySelector('.pips');
        if (pips.children.length !== limit) {
            pips.replaceChildren();
            for (let i = 0; i < limit; i++) pips.append(el('span', 'pip'));
        }
        const n = now();
        const remaining = slots.map((x) => x - n).sort((a, b) => b - a); // freshest first
        [...pips.children].forEach((p, i) => {
            const r = remaining[i];
            p.classList.toggle('held', r != null);
            p.style.setProperty('--p', r != null ? Math.max(0.02, r / win).toFixed(3) : 0);
            p.title = r != null ? `Slot taken. Free again in ${dur(r)}` : 'Free slot';
        });
        pips.setAttribute('aria-label', `${slots.length} of ${limit} licence slots in use`);
        const val = node.querySelector('.next-val');
        const lbl = node.querySelector('.next-lbl');
        if (slots.length >= limit) {
            val.textContent = dur(slots[slots.length - limit] - n);
            lbl.textContent = 'until a new session is allowed';
        } else if (slots.length) {
            val.textContent = dur(slots[0] - n);
            lbl.textContent = 'until a slot is free again';
        } else {
            val.textContent = '—';
            lbl.textContent = 'no slots in use';
        }
    }

    function renderUsers() {
        const list = $('userList');
        const all = shownUsers();
        const limit = mode === 'wall' ? WALL_TILES : pageLimit;
        const users = all.slice(0, limit);
        const keep = new Set(users.map((u) => u.key));
        for (const [key, node] of userEls) {
            if (!keep.has(key)) {
                node.remove();
                userEls.delete(key);
            }
        }
        users.forEach((u, i) => {
            let node = userEls.get(u.key);
            if (!node) {
                node = buildUser(u);
                userEls.set(u.key, node);
            }
            if (list.children[i] !== node) list.insertBefore(node, list.children[i] || null);
            fillUser(node, u);
            updateOpen(node);
        });

        const connected = visibleLicensedUsers().filter((u) => u.proxySessions > 0).length;
        const calm = mode === 'wall' && all.length === 0;
        $('calm').hidden = !calm;
        if (calm) {
            const top = Math.max(0, ...visibleLicensedUsers().map((u) => liveSlots(u).length));
            $('calmTitle').textContent =
                `All ${connected} connected user${connected === 1 ? ' is' : 's are'} within limits`;
            $('calmSub').textContent =
                `Everyone has at least ${state.config.slotsLimit - state.config.warnAt + 1} slots free, and no one was refused in the last 15 minutes. Most slots held by one user: ${top} of ${state.config.slotsLimit}.`;
        }
        $('usersEmpty').hidden = users.length > 0 || calm;
        // Say plainly when a filter or search hides users, with one click back to everyone.
        const q = $('search').value.trim();
        const filtered = mode !== 'wall' && (filter !== 'all' || q);
        $('filterNote').hidden = !filtered;
        if (filtered) {
            const what = filter.startsWith('slots:')
                ? `users with ${filter.slice(6)} slot${filter.slice(6) === '1' ? '' : 's'} in use`
                : filter === 'all'
                  ? 'users'
                  : `users who are “${FILTERS.find(([f]) => f === filter)?.[1] ?? filter}”`;
            const total = candidates().length;
            $('filterText').textContent =
                `Showing only ${what}${q ? ` matching “${q}”` : ''}: ${all.length} of ${total}.`;
        }
        const more = all.length - users.length;
        $('pager').hidden = more <= 0;
        $('pagerText').textContent =
            mode === 'wall'
                ? `${more} more user${more === 1 ? '' : 's'} need attention. Switch to Desk to see all.`
                : `Showing ${users.length} of ${all.length}`;
        $('more').hidden = mode === 'wall';
        $('more').textContent = `Show ${Math.min(PAGE, more)} more`;

        const unl = state.users.filter((u) => !u.gone && !u.licence && !u.slotsUsed);
        $('unlicensedCount').textContent = unl.length
            ? `(${unl.length}, ${unl.reduce((a, u) => a + u.proxySessions, 0)} sessions)`
            : '(none)';
        $('usersTitle').textContent = mode === 'wall' ? 'Needs attention' : 'Users';
        $('usersHint').textContent =
            mode === 'wall'
                ? ''
                : `Each user can be active in at most ${state.config.slotsLimit} sessions within any ${state.config.windowSeconds / 60} minutes. Each of those takes a slot.`;
    }

    /* ---------- timelines: fetched only for users whose row is open ---------- */
    async function fetchTimeline(node) {
        const key = node.dataset.key;
        if (node._tlFor === state.at || node._tlLoading) return;
        node._tlLoading = true;
        try {
            const r = await fetch(`api/timeline?user=${encodeURIComponent(key)}`);
            if (r.ok) {
                node._tl = await r.json();
                node._tlFor = state.at;
                if (open.has(key)) drawTimeline(node);
            }
        } catch {
            /* the next update tries again */
        } finally {
            node._tlLoading = false;
        }
    }

    /* ---------- per-user timeline ---------- */
    // When a session started: its licence record's creation time if it has one (that is when it first
    // loaded a page), otherwise when the monitor first saw it.
    function startOf(e) {
        const seen = t(e.firstSeen);
        const rec = t(e.recordCreated);
        if (seen == null) return rec;
        return rec != null ? Math.min(seen, rec) : seen;
    }
    function drawTimeline(node) {
        const u = node._u;
        const box = node.querySelector('.timeline');
        if (!node._tl) {
            box.replaceChildren(el('p', 'tl-more', 'Loading sessions…'));
            return;
        }
        const tl = node._tl;
        const n = now();
        const win = state.config.windowSeconds * 1000;
        const rows = tl.timeline.slice(0, 12);
        const starts = rows.map(startOf).filter((x) => x != null);
        const earliest = starts.length ? Math.min(...starts) : n;
        const t0 = Math.max(
            n - state.config.timelineMinutes * 60000,
            Math.min(n - 10 * 60000, earliest - 60000)
        );
        const t1 = n + win;
        const W = Math.max(320, box.clientWidth || 700);
        const L = 128;
        const R = 10;
        const rowH = 22;
        const top = 22;
        const H = top + rows.length * rowH + 20;
        const x = (ms) => L + ((Math.min(Math.max(ms, t0), t1) - t0) / (t1 - t0)) * (W - L - R);
        const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' });
        s.setAttribute(
            'aria-label',
            `Sessions of ${who(u)} over the last ${state.config.timelineMinutes} minutes`
        );

        // Axis: a tick every 5 minutes, plus where the window ends.
        const axis = svg('g', {}, 'tl-axis');
        const step = 5 * 60000;
        for (let m = Math.ceil(t0 / step) * step; m <= t1; m += step) {
            axis.append(svg('line', { x1: x(m), x2: x(m), y1: top - 4, y2: H }, 'tl-grid'));
            const lab = svg('text', { x: x(m), y: 11, 'text-anchor': 'middle' });
            lab.textContent = clock(m);
            axis.append(lab);
        }
        s.append(axis);

        rows.forEach((e, i) => {
            const y = top + i * rowH + rowH / 2;
            const g = svg('g');
            const label = svg('text', { x: 0, y: y + 3.5 }, `tl-label${e.live ? ' is-live' : ''}`);
            label.textContent = `${vpName(e.virtualProxy)} · ${String(e.sessionId).slice(0, 4)}`;
            g.append(label);
            const tip = svg('title');
            const bits = [`Session ${e.sessionId}`, `virtual proxy ${vpName(e.virtualProxy)}`];
            if (e.proxyNode) bits.push(`node ${e.proxyNode}`);
            if (e.firstSeen)
                bits.push(
                    `${e.seenAtStart ? 'open when the monitor started' : 'opened'} ${clockS(t(e.firstSeen))}`
                );
            if (e.endedAt) bits.push(`ended ${clockS(t(e.endedAt))}`);
            if (e.state === 'refused') bits.push('refused: no licence slot');
            if (e.latestActivity) bits.push(`last licence check ${clockS(t(e.latestActivity))}`);
            if (e.slotUntil)
                bits.push(
                    `slot ${t(e.slotUntil) > n ? 'frees' : 'freed'} ${clockS(t(e.slotUntil))}`
                );
            if (e.state === 'swept')
                bits.push('record removed by the hourly sweep; renewed on the next app open');
            tip.textContent = bits.join('\n');
            g.append(tip);

            // Proxy session: a line from when it opened to when it ended (or now).
            if (e.firstSeen) {
                const a = startOf(e);
                const b = e.endedAt ? t(e.endedAt) : n;
                if (b > t0)
                    g.append(
                        svg(
                            'line',
                            { x1: x(a), x2: Math.max(x(a) + 2, x(b)), y1: y, y2: y },
                            `tl-proxy${e.live ? ' is-live' : ''}`
                        )
                    );
            }
            // Licence slot: held from the last licence check until six minutes later.
            if (e.latestActivity) {
                const a = t(e.latestActivity);
                const b = t(e.slotUntil);
                if (b <= n) {
                    if (b > t0)
                        g.append(
                            svg(
                                'rect',
                                {
                                    x: x(a),
                                    y: y - 4,
                                    width: Math.max(3, x(b) - x(a)),
                                    height: 8,
                                    rx: 4,
                                },
                                'tl-slot idle'
                            )
                        );
                } else {
                    if (n > a)
                        g.append(
                            svg(
                                'rect',
                                {
                                    x: x(a),
                                    y: y - 4,
                                    width: Math.max(3, x(n) - x(a)),
                                    height: 8,
                                    rx: 4,
                                },
                                'tl-slot'
                            )
                        );
                    g.append(
                        svg(
                            'rect',
                            {
                                x: x(Math.max(a, n)),
                                y: y - 4,
                                width: Math.max(3, x(b) - x(Math.max(a, n))),
                                height: 8,
                                rx: 4,
                            },
                            'tl-slot future'
                        )
                    );
                }
            }
            if (e.state === 'refused' && e.firstSeen) {
                const cx = x(t(e.firstSeen));
                g.append(
                    svg(
                        'path',
                        {
                            d: `M${cx - 4} ${y - 4}L${cx + 4} ${y + 4}M${cx + 4} ${y - 4}L${cx - 4} ${y + 4}`,
                        },
                        'tl-ref'
                    )
                );
            }
            s.append(g);
        });

        s.append(svg('line', { x1: x(n), x2: x(n), y1: top - 6, y2: H - 14 }, 'tl-now'));
        const nl = svg('text', { x: x(n), y: H - 2, 'text-anchor': 'middle' }, 'tl-now-label');
        nl.textContent = 'now';
        s.append(nl);

        box.replaceChildren(s);
        if (tl.timelineTotal > rows.length)
            box.append(
                el('p', 'tl-more', `${tl.timelineTotal - rows.length} older sessions not shown.`)
            );
        if (!rows.length) box.append(el('p', 'tl-more', 'No sessions in the last half hour.'));
    }

    /* ---------- entry points ---------- */
    function renderEntry() {
        const box = $('entry');
        box.replaceChildren();
        const wrap = el('div', 'entry');
        for (const [title, data, fmt] of [
            ['Virtual proxies', state.breakdown.virtualProxies, vpName],
            ['Proxy nodes', state.breakdown.nodes, (n) => n],
        ]) {
            const entries = Object.entries(data || {}).sort(
                (a, b) => b[1].sessions - a[1].sessions
            );
            if (!entries.length) continue;
            wrap.append(el('h3', null, title));
            const max = Math.max(1, ...entries.map(([, v]) => v.sessions));
            for (const [name, v] of entries) {
                const r = el('div', 'erow');
                const bar = el('div', 'bar');
                const i = el('i', 'used');
                i.style.width = `${(v.sessions / max) * 100}%`;
                bar.append(i);
                const num = el(
                    'span',
                    'e-num',
                    `${v.sessions} session${v.sessions === 1 ? '' : 's'} · ${v.users} user${v.users === 1 ? '' : 's'}`
                );
                if (v.refused)
                    num.append(
                        document.createTextNode(' · '),
                        el('span', 'r', `${v.refused} refused`)
                    );
                const nm = el('span', 'e-name', fmt(name));
                nm.title = fmt(name);
                r.append(nm, bar, num);
                wrap.append(r);
            }
        }
        if (!wrap.children.length) wrap.append(el('p', 'empty', 'No proxy sessions.'));
        box.append(wrap);
    }

    /* ---------- feed ---------- */
    const eventKey = (e) =>
        [
            e.type,
            e.at,
            e.sessionId || '',
            e.userDirectory || '',
            e.userId || '',
            e.level || '',
        ].join('|');
    function describe(e) {
        const u = e.userId ? who(e) : '';
        const vp = e.virtualProxy ? vpName(e.virtualProxy) : '';
        switch (e.type) {
            case 'licensed':
                return [
                    'f-licensed',
                    [u, ' signed in'],
                    `${vp} · took slot ${e.slotsUsed ?? '?'} of ${e.slotsLimit}`,
                ];
            case 'refused':
                return [
                    'f-refused',
                    [u, ' was refused a session'],
                    `${vp} · all licence slots in use`,
                ];
            case 'session-ended':
                return [
                    'f-ended',
                    [u, e.refused ? ' closed a refused session' : ' ended a session'],
                    vp,
                ];
            case 'sweep':
                return [
                    'f-sweep',
                    ['Repository removed ', String(e.recordsRemoved), ' licence records'],
                    'Hourly cleanup. Live sessions get a new record when they are next used in an app.',
                ];
            case 'alert': {
                const nf = e.nextSlotFreeAt
                    ? ` · next slot frees ${clockS(t(e.nextSlotFreeAt))}`
                    : '';
                if (e.level === 'critical')
                    return [
                        'f-critical',
                        [u, ' reached the limit'],
                        `${e.slotsUsed} of ${e.slotsLimit} slots in use${nf}`,
                    ];
                if (e.level === 'warn')
                    return [
                        'f-warn',
                        [
                            u,
                            e.change === 'lowered'
                                ? ' is below the limit again'
                                : ' has one slot left',
                        ],
                        `${e.slotsUsed} of ${e.slotsLimit} slots in use${nf}`,
                    ];
                return [
                    'f-cleared',
                    [u, ' is clear'],
                    `${e.slotsUsed} of ${e.slotsLimit} slots in use`,
                ];
            }
            default:
                return ['', [e.type], ''];
        }
    }
    const ACTIVITY = new Set(['licensed', 'session-ended']);
    let showActivity = store.get('sm.activity', '0') === '1';
    $('showActivity').checked = showActivity;
    $('showActivity').addEventListener('change', (e) => {
        showActivity = e.target.checked;
        store.set('sm.activity', showActivity ? '1' : '0');
        renderFeed();
    });
    function addEvents(events, animate) {
        let added = false;
        for (const e of events) {
            const k = eventKey(e);
            if (seenEvents.has(k)) continue;
            seenEvents.add(k);
            feedItems.unshift({ e, k, isNew: animate });
            added = true;
        }
        // Keep up to 200 important events and 300 sign-ins and ended sessions, as the server does.
        let imp = 0;
        let act = 0;
        feedItems = feedItems.filter((x) => (ACTIVITY.has(x.e.type) ? ++act <= 300 : ++imp <= 200));
        // Remember only the keys of events still kept, so an always-open page doesn't grow forever.
        seenEvents.clear();
        for (const x of feedItems) seenEvents.add(x.k);
        if (added) renderFeed();
    }
    // Several events of the same kind from one update become one line ("12 sessions signed in").
    function grouped(items) {
        const out = [];
        for (const item of items) {
            const last = out[out.length - 1];
            const groupable = ['licensed', 'refused', 'session-ended'].includes(item.e.type);
            if (groupable && last && last.e.type === item.e.type && last.e.at === item.e.at) {
                (last.group ??= [last.e]).push(item.e);
                last.isNew ||= item.isNew;
            } else out.push({ ...item });
        }
        return out
            .map((x) =>
                x.group && x.group.length > 3
                    ? x
                    : x.group
                      ? x.group.map((e) => ({ e, isNew: x.isNew }))
                      : [x]
            )
            .flat();
    }
    function describeGroup(g) {
        const names = [...new Set(g.group.map((e) => e.userId))];
        const list = `${names.slice(0, 4).join(', ')}${names.length > 4 ? ` and ${names.length - 4} more` : ''}`;
        const n = g.group.length;
        if (g.e.type === 'licensed') return ['f-licensed', [`${n} sessions signed in`], list];
        if (g.e.type === 'refused') return ['f-refused', [`${n} sessions refused`], list];
        return ['f-ended', [`${n} sessions ended`], list];
    }
    function renderFeed() {
        const list = $('feed');
        list.replaceChildren();
        const visible = feedItems.filter((x) =>
            showActivity && mode !== 'wall' ? true : !ACTIVITY.has(x.e.type)
        );
        for (const item of grouped(visible).slice(0, mode === 'wall' ? 12 : 60)) {
            const [cls, main, sub] = item.group ? describeGroup(item) : describe(item.e);
            const li = el('li', `${cls}${item.isNew ? ' new' : ''}`);
            const text = el('div', 'f-text');
            // First part of `main` is a name or a count (bold); the rest is plain text.
            main.forEach((part, i) =>
                text.append(
                    (i === 0 && (item.e.userId || item.group)) ||
                        (i === 1 && item.e.type === 'sweep')
                        ? el('b', null, part)
                        : document.createTextNode(part)
                )
            );
            if (sub) text.append(el('small', null, sub));
            const time = el('time', null, ago(t(item.e.at)));
            time.dateTime = item.e.at;
            time.title = new Date(t(item.e.at)).toLocaleString();
            li.append(el('span', 'fdot'), text, time);
            list.append(li);
        }
        for (const item of feedItems) item.isNew = false;
        $('feedEmpty').hidden = visible.length > 0;
        $('feedEmpty').textContent = showActivity
            ? 'Sign-ins, refusals and alerts appear here as they happen.'
            : 'Refusals and alerts appear here as they happen. Tick “Sign-ins” to see every new session too.';
    }

    /* ---------- whole page ---------- */
    function render() {
        $('site').textContent = state.site || '';
        renderKpis();
        renderLicences();
        renderDist();
        renderChips();
        renderUsers();
        renderEntry();
        renderFeed();
        const c = state.config;
        $('rule').textContent =
            `Close to real time: new data every ${state.pollSeconds} s, no history. Watching since ${clock(t(state.startedAt))}.`;
        $('errors').textContent =
            (state.summary.licencesUnknown
                ? 'Licence data could not be read yet: slot counts are unknown, not zero. '
                : '') +
            (state.summary.licencesStale
                ? 'Licence data could not be read: slots show the last good reading. '
                : '') +
            (state.summary.sessionsStale
                ? 'A proxy could not be read: its sessions show the last good reading. '
                : '') +
            (state.summary.errors.length
                ? `Problems reading Sense: ${state.summary.errors.join('; ')}`
                : '');
    }

    function receive(s) {
        // `now` is the server's current time (same clock as the data); `at` is when the data was read.
        offset = Date.parse(s.now || s.at) - Date.now();
        lastMessage = Date.now();
        const first = !state;
        state = s;
        // A fresh page (or a reconnect) gets recent events from api/state; each update after that
        // carries only its own events.
        addEvents(
            (s.recentEvents || s.events || [])
                .slice()
                .sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
            !first
        );
        render();
        for (const node of userEls.values())
            if (open.has(node.dataset.key) && mode !== 'wall') fetchTimeline(node);
        if (!first) {
            for (const e of s.events) {
                if (e.type === 'refused' || (e.type === 'alert' && e.level === 'critical')) {
                    const node = userEls.get(`${e.userDirectory}\\${e.userId}`.toLowerCase());
                    if (node) {
                        node.classList.remove('flash');
                        void node.offsetWidth;
                        node.classList.add('flash');
                    }
                }
            }
        }
    }

    // Every second: countdowns, pips, "x s ago", the timeline's now line, and the connection badge.
    setInterval(() => {
        const live = $('live');
        const stale =
            !lastMessage || Date.now() - lastMessage > 3 * (state?.pollSeconds || 15) * 1000;
        live.classList.toggle('on', !!lastMessage && !stale);
        live.classList.toggle('stale', !!lastMessage && stale);
        $('liveText').textContent = !lastMessage ? 'Connecting…' : stale ? 'No data' : 'Live';
        if (!state) return;
        $('updated').textContent = `updated ${ago(t(state.at))}`;
        for (const node of userEls.values()) {
            tickUser(node);
            if (open.has(node.dataset.key) && mode !== 'wall') drawTimeline(node);
        }
        renderKpis();
        renderDist();
        for (const tm of $('feed').querySelectorAll('time'))
            tm.textContent = ago(Date.parse(tm.dateTime));
    }, 1000);

    const loadState = () =>
        fetch('api/state')
            .then((r) => (r.ok ? r.json() : null))
            .then((s) => s && receive(s))
            .catch(() => {});
    const es = new EventSource('events');
    es.onmessage = (m) => receive(JSON.parse(m.data));
    // On every (re)connect, catch up on what was missed while disconnected.
    es.onopen = loadState;
    window.addEventListener('resize', () => {
        for (const node of userEls.values()) if (open.has(node.dataset.key)) drawTimeline(node);
    });
})();
