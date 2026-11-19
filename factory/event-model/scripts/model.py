"""Layout engine for Event Model frames and Event Storming walls.

The notation follows Martin Dilger's Event Modeling cheat sheet (https://www.eventmodelers.ai/cheatsheet)
and the usual Event Storming sticky grammar.

Event Model, rows top to bottom:
  external systems (pink, a local addition) ; screens, or a processor gear "when nobody clicks" ;
  commands ; one event lane per owning context (Dilger: "a horizontal lane per owner") ;
  read models ("read models sit below") ; business rules (Given / When / Then) below each slice.
Slice patterns (Dilger's four):
  State Change  screen -> command -> event
  State View    events -> read model -> screen
  Automation    event -> to-do read model -> processor gear -> command -> event
                (no resulting event: the gear calls the external system itself)
  Translation   outside event -> to-do read model -> gear -> command -> event in our own words
A hollow event marks a state change the code makes without dispatching an event (a local
addition, not Dilger notation).

Event Storming wall: six sticky types plus Dilger's red hot spot, with arrows
actor -> command -> event -> policy -> event.

Every box is sized from its text at 14 px, so nothing overflows.

Product text (names, intros, legend wording) comes from the product config: see DEFAULTS and
configure(). Notation colours stay here.

em(frame) / es(frame) / modules(frames) / legend_em(...) / legend_es(...) -> Frame dict:
  {key, view, title, w, h, nodes: [...], edges: [...], slices: [...], texts: [...]}
  node  {id, kind, text, x, y, w, h, hollow?}
  edge  {id, src, dst, route: ('straight',) | ('hvh', gx) | ('hvhv', gx, cy) | ('vhv', cy),
         sides: (srcSide, dstSide), dashed}
  slice {id, text, x, y, w, h, type}
  text  {id, text, x, y, w, size: 'small'|'body'|'large'|'title', color, bold}
Text may hold [label](#em-01) links; the emitters turn the anchors into page anchors or board urls.
"""
import collections
import importlib.util
import os
import re
import sys
PAL = {
    'screen': ('#ffffff', '#57546c'),
    'cmd': ('#6db6f5', '#4d97d9'),
    'ev': ('#ff9e2c', '#e0821a'),
    'rej': ('#fecaca', '#dc2626'),
    'rm': ('#b5e48c', '#7fb35a'),
    'todo': ('#b5e48c', '#7fb35a'),
    'ext': ('#ff9cc8', '#e070a8'),
    'policy': ('#c39be0', '#9a6fc0'),
    'actor': ('#f2c94c', '#c9a227'),
    'hot': ('#f87171', '#dc2626'),
    'spec': ('#fff6b6', '#c9a227'),
    'gear': ('#57546c', '#57546c'),
}
ARROW = '#7d7a90'
INK, BODY, MUTED = '#1f2937', '#4b5563', '#6b7280'
TYPE_INK = {'State Change': '#2f6fb0', 'State View': '#4f7f2a', 'Automation': '#57546c', 'Translation': '#b0407a'}

FS, LH, CHAR = 14, 21, 7.6        # 14 px text, 1.5 line height, a generous average glyph width
PAD = 12
BW = 208                           # box width
CW = 320                           # column pitch: a 56 px gutter each side of a box, three arrow tracks in each
TRACK = 16                         # distance between parallel arrow tracks (gutters and corridors)
GEAR = 52
LABEL_W = 176                      # left column of row and lane labels
GAP = 44                           # vertical gap between rows (room for arrow corridors)
SLICE_GAP = 28
HEAD_ROOM = 200                    # room between the story and the sections: the board draws section titles at a fixed screen size


# --- product config ---------------------------------------------------------------------------------
# A product's product.py exports PRODUCT, a dict that overrides these defaults. configure() merges it;
# load_product() calls configure() for you. Keys the engine does not know (out_dir, page_url,
# board_note, board_note_no_page) are read by wb.py.
DEFAULTS = {
    'name': 'Product',                     # legend titles: "<name> Event Model", "<name> Event Storming walls"
    'default_actor': 'User',               # actor sticky for a command or read model with no 'actor'
    'scheduler_actor': 'Scheduler',        # actor sticky for a timed automation
    'automation_prefixes': ('Scheduler', 'Every ', 'Nightly', 'Hourly', 'Daily'),   # a 'trg' starting so makes a processor an automation
    'out_dir': '.wb',                      # wb.py working folder, relative to the product folder
    'page_url': '',                        # claude.ai artifact of the read-only page, if the product has one
    'board_note': ('Generated from the journey files; the [Event Model page]({page_url}) is the reference. Add your own stickies '
                   'freely: a sync only rewrites what changed in the journeys.'),
    'board_note_no_page': ('Generated from the journey files. Add your own stickies freely: a sync only rewrites what changed '
                           'in the journeys.'),
    'modules_intro': ('Every event from every wall, deduplicated and grouped by the bounded context it sits in. Each cluster is a '
                      'candidate module. The policies on the walls become listeners in the module that reacts. '
                      'A hollow sticky is a change the code makes without dispatching an event.'),
    'legend_em_intro': ('A blueprint of every journey, drawn the way Martin Dilger\'s cheat sheet describes Event Modeling. Time runs '
                        'left to right. Each journey is cut into vertical slices, and each slice follows one of four patterns. The '
                        'business rules of a slice (Given / When / Then) sit directly beneath it.'),
    'legend_es_intro': ('The same journeys as the Event Model, drawn as an Event Storming wall. Time runs left to right. Each lane is '
                        'one bounded context, so the events that travel together sit in the same lane and the modules show up as '
                        'lanes. Both views are generated from one set of journey definitions, so they cannot disagree.'),
    'translation_text': ('Same shape as an automation, but the incoming event comes from outside and the result is phrased in the '
                         'product\'s own words.'),
    'em_cmd_desc': 'An intention to change state, in the user\'s words.',
    'em_hollow_desc': ('Hollow (white, orange outline): the code changes state without dispatching an event. Drawn the same on the '
                       'walls. A local addition, not Dilger notation.'),
    'em_todo_desc': ('An automation\'s to-do list. If the code reacts to the event directly, this box stands for its input.'),
    'em_ext_desc': 'A system outside the product that sends or receives a call. A local addition to the blueprint.',
    'gaps_heading': 'Gaps the board surfaced',
    'es_cmd_desc': 'Things someone does to make events happen. A timed job is a command issued by the scheduler.',
    'es_actor_desc': 'People or systems that issue commands.',
    'es_ext_desc': 'Things outside the domain that participate.',
    'es_hot_desc': ('Not one of the six core sticky types: a gap or open question the wall surfaced (Dilger draws hot spots as red notes). It sits under its '
                    'slice; a red dashed arrow points at the card it is about, and a hot spot about something missing has no arrow.'),
}
CFG = dict(DEFAULTS)
SLICE_TYPES = tuple(TYPE_INK)
COLUMN_KEYS = ('trg', 'cmd', 'rm', 'proc', 'ext', 'actor', 'ev', 'rml', 'from', 'extIn', 'rmlfrom', 'to')


def configure(product=None):
    """Reset the config to DEFAULTS, then apply the product's overrides."""
    CFG.clear()
    CFG.update(DEFAULTS)
    CFG.update(product or {})
    return CFG


def find_product_dir(argv):
    """(product folder, remaining args): --product DIR, else env EVENT_MODEL_PRODUCT, else the current folder."""
    args, d, i = [], None, 0
    while i < len(argv):
        if argv[i] == '--product':
            if i + 1 >= len(argv):
                raise SystemExit('--product needs a folder')
            d = argv[i + 1]
            i += 2
        elif argv[i].startswith('--product='):
            d = argv[i].split('=', 1)[1]
            i += 1
        else:
            args.append(argv[i])
            i += 1
    d = os.path.abspath(d or os.environ.get('EVENT_MODEL_PRODUCT') or os.getcwd())
    return d, args


def load_product(folder):
    """Import FOLDER/product.py, apply its PRODUCT config, and return (PRODUCT, FRAMES)."""
    path = os.path.join(folder, 'product.py')
    if not os.path.exists(path):
        raise SystemExit(f'no product.py in {folder}. Pass --product DIR, set EVENT_MODEL_PRODUCT, or run from the product folder.')
    sys.path.insert(0, folder)
    spec = importlib.util.spec_from_file_location('product', path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules['product'] = mod
    spec.loader.exec_module(mod)
    if not hasattr(mod, 'FRAMES'):
        raise SystemExit(f'{path} must export FRAMES (the ordered journey list)')
    product = dict(getattr(mod, 'PRODUCT', {}) or {})
    configure(product)
    return product, list(mod.FRAMES)


def lines(text, w, pad=PAD, char=CHAR):
    cpl = max(6, int((w - 2 * pad) / char))
    n = 0
    for para in text.split('\n'):
        cur, cnt = 0, 1
        for word in para.split(' '):
            L = len(word)
            if cur == 0:
                cur = L
            elif cur + 1 + L <= cpl:
                cur += 1 + L
            else:
                cnt, cur = cnt + 1, L
            while cur > cpl:
                cnt, cur = cnt + 1, cur - cpl
        n += cnt
    return n


def box_h(text, w=BW, minimum=64, pad=PAD, char=CHAR):
    return max(minimum, lines(text, w, pad, char) * LH + 2 * pad + 4)


SPEC_CHAR = 7.1                    # rule cards: measured on the board, long text averages narrower glyphs than CHAR


def text_of(v):
    return v if isinstance(v, str) else v[0]


def flag_of(v):
    return '' if isinstance(v, str) else v[1]


def lower_first(s):
    return s[:1].lower() + s[1:] if s and not s[:2].isupper() else s


def strip_parens(s):
    return re.sub(r'\s*\([^)]*\)', '', s).strip()


def slice_title(si, sl, es=False):
    return f'S{si + 1} · {sl["name"]}' + ('' if es else f' · {sl["type"]}')


def head_h(frame, slice_x, es=False):
    """Room above the first row: the board's section title (30), then the slice label inside the section."""
    return 30 + 12 + max(lines(slice_title(si, sl, es), ex - sx - 24, 0) for si, (sl, (sx, ex)) in enumerate(zip(frame['slices'], slice_x))) * LH + 20


def assign_levels(spans):
    """{source: (x0, x1)} -> {source: level}: sources whose spans overlap get different corridor levels."""
    levels, ends = {}, []
    for s, (a, z) in sorted(spans.items(), key=lambda kv: (kv[1][0], kv[1][1])):
        for i, end in enumerate(ends):
            if end + 2 * TRACK < a:
                levels[s] = i
                ends[i] = z
                break
        else:
            levels[s] = len(ends)
            ends.append(z)
    return levels


def spans(items, start, center):
    sp = {}
    for key_, sk, k in items:
        x0, x1 = start(key_, sk), center(k)
        a, z = sp.get(key_, (x0, x0))
        sp[key_] = (min(a, x0, x1), max(z, x0, x1))
    return sp


class Builder:
    def __init__(self, key, view, title):
        self.f = {'key': key, 'view': view, 'title': title, 'nodes': [], 'edges': [], 'slices': [], 'texts': []}
        self.by_id = {}

    def node(self, id_, kind, text, x, y, w, h, **kw):
        n = dict(id=id_, kind=kind, text=text, x=round(x), y=round(y), w=round(w), h=round(h), **kw)
        self.f['nodes'].append(n)
        self.by_id[id_] = n
        return n

    def edge(self, src, dst, route=('straight',), sides=('bottom', 'top'), dashed=False, color=None):
        if src not in self.by_id or dst not in self.by_id:
            raise KeyError(f'{self.f["key"]}: edge {src} -> {dst} names a missing node')
        e = dict(id=f'{src}>{dst}#{len(self.f["edges"])}', src=src, dst=dst, route=route, sides=sides, dashed=dashed)
        if color:
            e['color'] = color
        self.f['edges'].append(e)

    def text(self, id_, text, x, y, w, size='body', color=INK, bold=False):
        self.f['texts'].append(dict(id=id_, text=text, x=round(x), y=round(y), w=round(w), size=size, color=color, bold=bold))


def classify(c):
    trg = c.get('trg', '')
    if 'cmd' in c:
        return 'change'
    if 'proc' in c:
        if c.get('extIn'):
            return 'trans'
        if c.get('from') or not trg or trg.startswith(CFG['automation_prefixes']):
            return 'auto'
        return 'change'          # a person clicks and the handler runs: the proc is the command
    if 'rm' in c or 'rml' in c:
        return 'view'
    if 'trg' in c:
        return 'screen'
    return 'event'


def resolve(r, k, cols, lanes):
    part = r.split('.')
    ck = int(part[0][1:]) if part[0].startswith('c') else k + int(part[0])
    if part[1] in ('cmd', 'rm', 'proc', 'ext', 'trg'):
        return ck, part[1], None
    if part[1] == 'rml':
        return ck, 'rml', part[2]
    if part[1] not in lanes:
        raise KeyError(f'ref {r}: no lane {part[1]}')
    return ck, 'ev', part[1]


def em(frame):
    lanes = frame['lanes']
    key = frame['key']
    b = Builder(key, 'em', frame['title'])
    cols, slice_of, xs = [], [], []
    x = LABEL_W + 24
    slice_x = []
    for si, sl in enumerate(frame['slices']):
        sx = x
        for c in sl['cols']:
            cols.append(c)
            slice_of.append(si)
            xs.append(x)
            x += CW
        slice_x.append((sx, x))
        x += SLICE_GAP
    width = x + 24
    kinds = [classify(c) for c in cols]

    # --- box texts per column ------------------------------------------------------------------
    plan = []
    for k, c in enumerate(cols):
        p = {'kind': kinds[k]}
        kd = kinds[k]
        if c.get('ext'):
            p['ext'] = c['ext']
        if kd in ('change', 'view', 'screen') and c.get('trg') and not (kd == 'change' and c.get('extIn')):
            p['screen'] = c['trg']
        if kd == 'change':
            p['cmd'] = c.get('cmd') or c['proc']
            if c.get('ext') and not c.get('extIn') and not c.get('ev'):
                p['relay'] = True        # no event: a gear below the command calls the outside system
        if kd in ('auto', 'trans'):
            p['gear'] = True
            p['todo'] = 'To do: ' + lower_first(c['proc'])
            if kd == 'trans' and c.get('trg'):
                p['todo'] = 'To do: ' + lower_first(c['proc']) + '\n(' + c['trg'] + ')'
            if c.get('ev'):
                p['cmd'] = c['proc']
            else:
                p['caption'] = c['proc']
            if kd == 'auto' and c.get('trg') and not c.get('from'):
                p['caption'] = (p.get('caption', '') + '\n' if 'caption' in p else '') + c['trg']
            if not c.get('ev'):
                p['caption'] += '\nNo event recorded'
        if kd == 'view' and c.get('rm'):
            p['rm'] = c['rm']
        p['rml'] = dict(c.get('rml') or {})
        p['ev'] = dict(c.get('ev') or {})
        plan.append(p)

    # --- row heights -----------------------------------------------------------------------------
    def mx(vals, minimum):
        return max([minimum] + list(vals))
    has_ext = any('ext' in p for p in plan)
    h_ext = mx((box_h(p['ext'], BW, 56) for p in plan if 'ext' in p), 56) if has_ext else 0
    cap_h = mx((lines(p['caption'], BW, 0) * LH for p in plan if 'caption' in p), 0)
    h_top = mx([box_h(p['screen'], BW, 72) for p in plan if 'screen' in p] + [GEAR + 8 + cap_h], 72)
    h_cmd = mx((box_h(p['cmd'], BW, 56) for p in plan if 'cmd' in p), 56)
    h_lane = {ln: mx((box_h(text_of(p['ev'][ln]), BW, 56) for p in plan if ln in p['ev']), 56) for ln in lanes}

    def rm_stack(p):
        items = []
        if 'rm' in p:
            items.append(('rm', p['rm']))
        if 'todo' in p:
            items.append(('todo', p['todo']))
        for ln, v in p['rml'].items():
            items.append(('rml:' + ln, f'{ln}: {v}'))
        return items
    stacks = [rm_stack(p) for p in plan]
    h_rm = mx((sum(box_h(t, BW, 56) for _, t in s) + 12 * (len(s) - 1) for s in stacks if s), 56)

    # --- arrow tracks: one corridor level per source, distinct where their spans overlap ----------
    def gut_r(k, i):
        return xs[k] + (CW + BW) / 2 + TRACK * (i + 1)

    def gut_l(k, i):
        return xs[k] + (CW - BW) / 2 - TRACK * (i + 1)
    corr, under = [], []
    for k, c in enumerate(cols):
        has_tgt = 'todo' in plan[k] or 'rm' in plan[k]
        for r in c.get('from', []):
            sk, kind, ln = resolve(r, k, cols, lanes)
            if not has_tgt:
                continue
            if kind == 'ev':
                corr.append((('ev', sk, ln), sk, k))
            elif kind == 'proc':
                corr.append((('proc', sk, None), sk, k))
            elif kind == 'ext' and sk != k:
                corr.append((('ext', sk, None), sk, k))
            elif kind in ('rm', 'rml') and sk != k:
                under.append(((kind, sk, ln), sk, k))
        for r in c.get('rmlfrom', []):
            sk, kind, ln = resolve(r, k, cols, lanes)
            corr.append((('ev', sk, ln), sk, k))
    slot, per_col = {}, {}
    for key_, sk, _ in corr:
        if key_ not in slot:
            i = per_col.get(sk, 0)
            per_col[sk] = i + 1
            slot[key_] = gut_r(sk, 1 + i % 2)
    lev = assign_levels(spans(corr, lambda key_, sk: slot[key_], lambda k: xs[k] + CW / 2))
    ulev = assign_levels(spans(under, lambda key_, sk: gut_r(sk, 2), lambda k: xs[k] + CW / 2))
    band = (max(lev.values()) + 1) * TRACK if lev else 0
    uband = (max(ulev.values()) + 1) * TRACK if ulev else 0

    # --- y positions -----------------------------------------------------------------------------
    y = 0
    b.text('title', f'{key} · {frame["title"].split(" · ", 1)[1]}', 24, y, 2400, 'title', INK, True)
    y += 76
    b.text('story', frame['story'], 24, y, min(width - 48, 1800), 'body', BODY)
    y += lines(frame['story'], min(width - 48, 1800), 0) * 24 + HEAD_ROOM
    y_slice = y
    y += head_h(frame, slice_x)               # slice header, wrapped to the slice width
    rows = []
    if has_ext:
        rows.append(('ext', 'External systems', y, h_ext)); y += h_ext + GAP
    rows.append(('top', 'Screens, or a processor when nobody clicks', y, h_top)); y += h_top + GAP
    rows.append(('cmd', 'Commands', y, h_cmd)); y += h_cmd + GAP
    lane_y = {}
    for ln in lanes:
        rows.append(('lane', ln, y, h_lane[ln])); lane_y[ln] = y; y += h_lane[ln] + GAP
    y_corr0 = y - GAP + 10                    # corridor between the last lane and the read models
    y = max(y, y_corr0 + band + 24)
    rows.append(('rm', 'Read models', y, h_rm)); y_rm = y; y += h_rm + GAP
    y_under0 = y_rm + h_rm + 10               # corridor under the read models, for read model -> read model
    y = max(y, y_under0 + uband + 24)
    y_spec = y
    row_y = {r[0]: r[2] for r in rows}

    # --- nodes -----------------------------------------------------------------------------------
    ids = {}
    for k, p in enumerate(plan):
        nx = xs[k] + (CW - BW) / 2
        if 'ext' in p:
            ids[(k, 'ext')] = b.node(f'c{k}.ext', 'ext', p['ext'], nx, row_y['ext'], BW, h_ext)['id']
        if 'screen' in p:
            ids[(k, 'screen')] = b.node(f'c{k}.screen', 'screen', p['screen'], nx, row_y['top'], BW, box_h(p['screen'], BW, 72))['id']
        if p.get('gear'):
            gx = xs[k] + (CW - GEAR) / 2
            ids[(k, 'gear')] = b.node(f'c{k}.gear', 'gear', '', gx, row_y['top'], GEAR, GEAR)['id']
            if 'caption' in p:
                b.text(f'c{k}.caption', p['caption'], nx, row_y['top'] + GEAR + 6, BW, 'small', MUTED)
        if 'cmd' in p:
            ids[(k, 'cmd')] = b.node(f'c{k}.cmd', 'cmd', p['cmd'], nx, row_y['cmd'], BW, h_cmd)['id']
        if p.get('relay'):
            gy = lane_y[lanes[0]]
            ids[(k, 'relay')] = b.node(f'c{k}.relay', 'gear', '', xs[k] + (CW - GEAR) / 2, gy, GEAR, GEAR)['id']
            b.text(f'c{k}.relaycap', 'No event recorded', nx, gy + GEAR + 4, BW, 'small', MUTED)
        for ln, v in p['ev'].items():
            fl = flag_of(v)
            ids[(k, 'ev', ln)] = b.node(f'c{k}.ev.{lanes.index(ln)}', 'rej' if fl == '!' else 'ev', text_of(v), nx, lane_y[ln],
                                        BW, h_lane[ln], hollow=(fl == '~'))['id']
        yy = y_rm
        for name, t in stacks[k]:
            hh = box_h(t, BW, 56)
            nid = f'c{k}.{name.split(":")[0]}' + (f'.{lanes.index(name[4:])}' if name.startswith('rml:') else '')
            ids[(k, name)] = b.node(nid, 'todo' if name == 'todo' else 'rm', t, nx, yy, BW, hh)['id']
            yy += hh + 12

    def ev_targets(k, p, src):
        evs = [ids[(k, 'ev', ln)] for ln in lanes if ln in p['ev']]
        for i, e in enumerate(evs):
            if i == 0:
                b.edge(src, e)
            else:                                     # in on the left: an event's right side only sends
                b.edge(src, e, ('hvh', gut_l(k, 0)), ('left', 'left'))

    def src_of(kind, sk, ln):
        if kind == 'ev':
            return ids[(sk, 'ev', ln)]
        if kind == 'rml':
            return ids[(sk, 'rml:' + ln)]
        if kind == 'proc':
            return ids.get((sk, 'cmd')) or ids[(sk, 'gear')]
        return ids[(sk, kind)]

    def via_corridor(src, key_, dst, dashed=False):
        b.edge(src, dst, ('hvhv', slot[key_], y_corr0 + TRACK * (lev[key_] + 1)), ('right', 'top'), dashed=dashed)

    for k, p in enumerate(plan):
        c = cols[k]
        if 'screen' in p and 'cmd' in p:
            b.edge(ids[(k, 'screen')], ids[(k, 'cmd')])
        if p.get('gear') and 'cmd' in p:
            b.edge(ids[(k, 'gear')], ids[(k, 'cmd')])
        if 'cmd' in p:
            ev_targets(k, p, ids[(k, 'cmd')])
        # externals
        if 'ext' in p:
            e = ids[(k, 'ext')]
            if p.get('gear'):
                if c.get('extIn'):
                    b.edge(e, ids[(k, 'todo')], ('hvhv', gut_l(k, 1), y_rm - 8), ('left', 'top'), dashed=True)
                else:
                    b.edge(ids[(k, 'gear')], e, ('straight',), ('top', 'bottom'), dashed=True)
            elif 'screen' in p and 'cmd' not in p:
                if c.get('extIn'):
                    b.edge(e, ids[(k, 'screen')], ('straight',), ('bottom', 'top'), dashed=True)
                else:
                    b.edge(ids[(k, 'screen')], e, ('straight',), ('top', 'bottom'), dashed=True)
            elif p.get('relay'):
                b.edge(ids[(k, 'cmd')], ids[(k, 'relay')])
                b.edge(ids[(k, 'relay')], e, ('hvh', gut_r(k, 0)), ('right', 'right'), dashed=True)
            elif 'cmd' in p:
                if c.get('extIn'):
                    b.edge(e, ids[(k, 'cmd')], ('straight',), ('bottom', 'top'), dashed=True)
                else:                                 # into the bottom: the system's right side sends to later slices
                    b.edge(ids[(k, 'cmd')], e, ('hvhv', gut_r(k, 0), row_y['ext'] + h_ext + 10), ('right', 'bottom'), dashed=True)
        # to-do read model -> gear
        if p.get('gear'):
            b.edge(ids[(k, 'todo')], ids[(k, 'gear')], ('hvh', gut_r(k, 0)), ('right', 'right'))
        # read model -> screen
        if 'rm' in p and 'screen' in p:
            b.edge(ids[(k, 'rm')], ids[(k, 'screen')], ('hvh', gut_l(k, 1)), ('left', 'left'))
        # sources
        tgt = ids.get((k, 'todo')) or ids.get((k, 'rm'))
        for r in c.get('from', []):
            sk, kind, ln = resolve(r, k, cols, lanes)
            src = src_of(kind, sk, ln)
            if tgt is None:
                if kind == 'ext' and (k, 'screen') in ids:
                    b.edge(src, ids[(k, 'screen')], ('hvh', gut_r(sk, 0)), ('right', 'left'), dashed=True)
                continue
            if kind in ('rm', 'rml'):
                if sk == k:
                    b.edge(src, tgt, ('hvh', gut_l(k, 2)), ('left', 'left'))
                else:
                    b.edge(src, tgt, ('hvhv', gut_r(sk, 2), y_under0 + TRACK * (ulev[(kind, sk, ln)] + 1)), ('right', 'bottom'))
            elif kind == 'ext':
                if sk == k:
                    b.edge(src, tgt, ('hvh', gut_l(k, 1)), ('left', 'left'), dashed=True)
                else:
                    via_corridor(src, ('ext', sk, None), tgt, dashed=True)
            elif kind == 'proc':
                via_corridor(src, ('proc', sk, None), tgt)
            else:
                via_corridor(src, ('ev', sk, ln), tgt)
        for r in c.get('rmlfrom', []):
            sk, kind, ln = resolve(r, k, cols, lanes)
            for rl in p['rml']:
                via_corridor(ids[(sk, 'ev', ln)], ('ev', sk, ln), ids[(k, 'rml:' + rl)])
        for kind, r in c.get('to', []):
            src = ids[(k, 'rml:' + lanes[int(kind.split('_')[1])])] if kind.startswith('rml') else ids[(k, kind)]
            tk, tkind, _ = resolve(r, k, cols, lanes)
            dst = ids[(tk, tkind)]
            if tk == k and tkind == 'rm' and 'todo' not in p:
                b.edge(src, dst, ('straight',), ('top', 'bottom'))
            else:
                b.edge(src, dst, ('hvh', gut_l(k, 2)), ('left', 'left'))

    # --- slices, rule cards, labels ----------------------------------------------------------------
    spec_hs = [box_h('\n'.join(sl['spec']), ex - sx - 16, 80, char=SPEC_CHAR) for sl, (sx, ex) in zip(frame['slices'], slice_x)]
    spec_h = max(spec_hs)
    for si, sl in enumerate(frame['slices']):
        sx, ex = slice_x[si]
        b.node(f's{si}.spec', 'spec', '\n'.join(sl['spec']), sx + 8, y_spec, ex - sx - 16, spec_hs[si])
        b.f['slices'].append(dict(id=f's{si}', text=slice_title(si, sl), type=sl['type'],
                                  x=sx, y=y_slice, w=ex - sx, h=y_spec + spec_h + 12 - y_slice))
    rows.append(('spec', 'Business rules (Given / When / Then)', y_spec, spec_h))
    for name, label, ry, rh in rows:
        color = '#b45309' if name == 'lane' else MUTED
        b.text(f'row.{name}.{label}', label, 16, ry + 8, LABEL_W - 16, 'small', color, True)
    height = y_spec + spec_h + 40
    b.f.update(w=width, h=height)
    return b.f


# ------------------------------------------------------------------------------------------------
# Event Storming wall
# ------------------------------------------------------------------------------------------------
SW = 200
SPITCH = 312                        # a 56 px gutter each side of a sticky, three arrow tracks in each


def policy_text(c, k, cols, lanes):
    evs, exts = [], []
    for r in c.get('from', []):
        sk, kind, ln = resolve(r, k, cols, lanes)
        if kind == 'ev':
            evs.append(strip_parens(text_of(cols[sk]['ev'][ln])).replace(': ', ' - '))
        elif kind == 'ext':
            exts.append(cols[sk]['ext'].split(':')[0])
        elif kind == 'rm' and cols[sk].get('trg'):
            evs.append(lower_first(cols[sk]['trg'].split(':')[0]))
    if c.get('extIn') and c.get('ext'):
        exts.append(c['ext'].split(':')[0])
    if evs:
        return f'When {" or ".join(evs[:2])}: {lower_first(c["proc"])}'
    if exts:
        return f'When {exts[0]} reports: {lower_first(c["proc"])}'
    if c.get('trg'):
        return f'When {lower_first(strip_parens(c["trg"]))}: {lower_first(c["proc"])}'
    return f'When it is time: {lower_first(c["proc"])}'


def es(frame):
    lanes = frame['lanes']
    key = frame['key']
    b = Builder(key, 'es', frame['title'])
    cols, xs, slice_x = [], [], []
    x = LABEL_W + 24
    for si, sl in enumerate(frame['slices']):
        sx = x
        for c in sl['cols']:
            cols.append(c)
            xs.append(x)
            x += SPITCH
        slice_x.append((sx, x))
        x += SLICE_GAP
    width = x + 24
    plan = []
    for k, c in enumerate(cols):
        p = {'ev': dict(c.get('ev') or {}), 'rml': dict(c.get('rml') or {})}
        kd = classify(c)
        if kd == 'change':
            p['actor'] = c.get('actor') or CFG['default_actor']
            p['mid'] = ('cmd', c.get('cmd') or c['proc'])
        elif kd == 'view':
            p['actor'] = c.get('actor') or CFG['default_actor']
            if c.get('rm'):
                p['mid'] = ('rm', c['rm'])
        elif kd == 'auto' and not c.get('from'):
            p['actor'] = c.get('actor') or CFG['scheduler_actor']
            p['mid'] = ('cmd', c['proc'])
        elif kd in ('auto', 'trans'):
            p['mid'] = ('policy', policy_text(c, k, cols, lanes))
        elif kd == 'screen' and c.get('actor') and c.get('ext') and not c.get('extIn'):
            p['actor'] = c['actor']          # the person acts in an outside system; nothing runs in ours
        if c.get('ext'):
            p['ext_in' if c.get('extIn') else 'ext_out'] = c['ext']
        if 'mid' in p and p['mid'][0] != 'rm' and not p['ev']:
            p['mid'] = (p['mid'][0], p['mid'][1] + '\n(no event recorded)')
        plan.append(p)

    def mx(vals, minimum):
        return max([minimum] + list(vals))
    h_src = mx([box_h(p['actor'], SW, 64) for p in plan if 'actor' in p] + [box_h(p['ext_in'], SW, 64) for p in plan if 'ext_in' in p], 64)
    h_mid = mx((box_h(p['mid'][1], SW, 96) for p in plan if 'mid' in p), 96)
    h_lane = {ln: mx([box_h(text_of(p['ev'][ln]), SW, 96) for p in plan if ln in p['ev']]
                     + [box_h(p['rml'][ln], SW, 96) for p in plan if ln in p['rml']], 96) for ln in lanes}
    has_out = any('ext_out' in p for p in plan)
    h_out = mx((box_h(p['ext_out'], SW, 64) for p in plan if 'ext_out' in p), 64) if has_out else 0
    hot = frame.get('hotspots', [])
    h_hot = mx((box_h(h[2], SW, 96) for h in hot), 96) if hot else 0

    def gut_r(k, i):
        return xs[k] + (SPITCH + SW) / 2 + TRACK * (i + 1)

    def gut_l(k, i):
        return xs[k] + (SPITCH - SW) / 2 - TRACK * (i + 1)
    corr = []
    for k, c in enumerate(cols):
        if 'mid' not in plan[k]:
            continue
        for r in c.get('from', []):
            sk, kind, ln = resolve(r, k, cols, lanes)
            if (kind == 'ev' and ln in plan[sk]['ev']) or (kind == 'rml' and ln in plan[sk]['rml']):
                corr.append(((kind, sk, ln), sk, k))
            elif kind == 'ext' and sk != k and 'ext_out' in plan[sk]:
                corr.append((('ext', sk, None), sk, k))
            elif kind == 'ext' and sk != k and 'ext_in' in plan[sk] and 'actor' not in plan[sk]:
                corr.append((('extin', sk, None), sk, k))
            elif kind == 'rm' and sk != k and plan[sk].get('mid', ('',))[0] == 'rm':
                corr.append((('rm', sk, None), sk, k))
    slot, per_col = {}, {}
    for key_, sk, _ in corr:
        if key_ not in slot:
            i = per_col.get(sk, 0)
            per_col[sk] = i + 1
            slot[key_] = gut_r(sk, 1 + i % 2)
    lev = assign_levels(spans(corr, lambda key_, sk: slot[key_], lambda k: xs[k] + SPITCH / 2))
    band = (max(lev.values()) + 1) * TRACK if lev else 0

    y = 0
    b.text('title', f'ES {key} · {frame["title"].split(" · ", 1)[1]}', 24, y, 2400, 'title', INK, True)
    y += 76
    b.text('story', frame['story'], 24, y, min(width - 48, 1800), 'body', BODY)
    y += lines(frame['story'], min(width - 48, 1800), 0) * 24 + HEAD_ROOM
    y_slice = y
    y += head_h(frame, slice_x, es=True)
    rows = [('src', 'Who or what starts it', y, h_src)]; y_src = y; y += h_src + GAP
    rows.append(('mid', 'Command, policy or read model', y, h_mid)); y_mid = y; y += h_mid + GAP
    y_corr0 = y - GAP + 8                     # corridor between the policies and the first lane
    y = max(y, y_corr0 + band + 20)
    lane_y = {}
    for ln in lanes:
        rows.append(('lane', ln, y, h_lane[ln])); lane_y[ln] = y; y += h_lane[ln] + GAP
    if has_out:
        rows.append(('out', 'Outside systems', y, h_out)); y_out = y; y += h_out + GAP
    if hot:
        rows.append(('hot', 'Hot spots', y, h_hot)); y_hot = y; y += h_hot + GAP
    y_end = y - GAP

    ids = {}
    for k, p in enumerate(plan):
        nx = xs[k] + (SPITCH - SW) / 2
        if 'actor' in p:
            ids[(k, 'src')] = b.node(f'c{k}.actor', 'actor', p['actor'], nx, y_src, SW, h_src)['id']
        elif 'ext_in' in p:
            ids[(k, 'src')] = b.node(f'c{k}.extin', 'ext', p['ext_in'], nx, y_src, SW, h_src)['id']
        if 'mid' in p:
            kind, t = p['mid']
            ids[(k, 'mid')] = b.node(f'c{k}.mid', kind, t, nx, y_mid, SW, h_mid)['id']
        for ln, v in p['ev'].items():
            ids[(k, 'ev', ln)] = b.node(f'c{k}.ev.{lanes.index(ln)}', 'rej' if flag_of(v) == '!' else 'ev', text_of(v),
                                        nx, lane_y[ln], SW, h_lane[ln], hollow=(flag_of(v) == '~'))['id']
        for ln, v in p['rml'].items():
            ids[(k, 'rml', ln)] = b.node(f'c{k}.rml.{lanes.index(ln)}', 'rm', v, nx, lane_y[ln], SW, h_lane[ln])['id']
        if 'ext_out' in p:
            ids[(k, 'out')] = b.node(f'c{k}.extout', 'ext', p['ext_out'], nx, y_out, SW, h_out)['id']
    slice_cols, k0 = [], 0
    for sl in frame['slices']:
        slice_cols.append(list(range(k0, k0 + len(sl['cols']))))
        k0 += len(sl['cols'])
    used = set()
    for i, (sname, target, t) in enumerate(hot):
        si = next((j for j, sl in enumerate(frame['slices']) if sl['name'] == sname), None)
        if si is None:
            raise KeyError(f'{key}: hot spot names no slice {sname!r}')
        tid, hk = None, None
        if target:
            for k in slice_cols[si]:
                for nid in [ids.get((k, 'mid'))] + [ids.get((k, 'ev', ln)) for ln in lanes]:
                    if nid and target in b.by_id[nid]['text']:
                        tid, hk = nid, k
                        break
                if tid:
                    break
            if tid is None:
                raise KeyError(f'{key}: hot spot target {target!r} is not in slice {sname!r}')
        if hk is None or hk in used:
            hk = next(k for k in slice_cols[si] if k not in used)
        used.add(hk)
        hid = b.node(f'hot{i}', 'hot', t, xs[hk] + (SPITCH - SW) / 2, y_hot, SW, h_hot)['id']
        if tid:
            tn = b.by_id[tid]
            hy = y_corr0 + band + 8 if tn['y'] == y_mid else tn['y'] + tn['h'] + 10   # a policy or command: under the corridor
            b.edge(hid, tid, ('hvhv', gut_l(hk, 2), hy), ('left', 'bottom'), dashed=True, color=PAL['hot'][1])

    for k, p in enumerate(plan):
        c = cols[k]
        if (k, 'src') in ids and (k, 'mid') in ids:
            b.edge(ids[(k, 'src')], ids[(k, 'mid')], dashed='ext_in' in p and 'actor' not in p)
        if (k, 'mid') in ids:
            evs = [ids[(k, 'ev', ln)] for ln in lanes if ln in p['ev']]
            if p['mid'][0] != 'rm':
                fed = bool(c.get('from'))      # arrows come into the bottom: go down the left gutter
                for i, e in enumerate(evs):
                    if i == 0 and not fed:
                        b.edge(ids[(k, 'mid')], e)
                    else:
                        b.edge(ids[(k, 'mid')], e, ('hvh', gut_l(k, 0)), ('left', 'left'))
            if (k, 'out') in ids:
                b.edge(ids[(k, 'mid')], ids[(k, 'out')], ('hvhv', gut_r(k, 0), y_out - 8), ('right', 'top'), dashed=True)
            for r in c.get('from', []):
                sk, kind, ln = resolve(r, k, cols, lanes)
                src = ids.get((sk, 'ev', ln)) if kind == 'ev' else ids.get((sk, 'rml', ln)) if kind == 'rml' else None
                key_ = (kind, sk, ln)
                if kind == 'ext' and sk != k:
                    if 'ext_out' in plan[sk]:
                        src, key_ = ids.get((sk, 'out')), ('ext', sk, None)
                    elif ('extin', sk, None) in slot:
                        src, key_ = ids.get((sk, 'src')), ('extin', sk, None)
                if kind == 'rm' and ('rm', sk, None) in slot:
                    src = ids.get((sk, 'mid'))
                if src:
                    b.edge(src, ids[(k, 'mid')], ('hvhv', slot[key_], y_corr0 + TRACK * (lev[key_] + 1)), ('right', 'bottom'),
                           dashed=kind == 'ext')
        if (k, 'mid') not in ids and (k, 'src') in ids and (k, 'out') in ids:
            b.edge(ids[(k, 'src')], ids[(k, 'out')], ('hvh', gut_r(k, 0)), ('right', 'right'), dashed=True)
        for kind, r in c.get('to', []):
            if kind.startswith('rml'):
                src = ids.get((k, 'rml', lanes[int(kind.split('_')[1])]))
                tk, tkind, _ = resolve(r, k, cols, lanes)
                dst = ids.get((tk, 'mid'))
                if src and dst:
                    b.edge(src, dst, ('hvh', gut_l(k, 1)), ('left', 'left'))
    for si, sl in enumerate(frame['slices']):
        sx, ex = slice_x[si]
        b.f['slices'].append(dict(id=f's{si}', text=slice_title(si, sl, True), type=sl['type'], x=sx, y=y_slice, w=ex - sx, h=y_end + 12 - y_slice))
    for name, label, ry, rh in rows:
        color = '#b45309' if name == 'lane' else ('#dc2626' if name == 'hot' else MUTED)
        b.text(f'row.{name}.{label}', label, 16, ry + 8, LABEL_W - 16, 'small', color, True)
    b.f.update(w=width, h=y_end + 40)
    return b.f


def modules(frames, key='99'):
    by_ctx, hollow = {}, {}
    for fr in frames:
        for sl in fr['slices']:
            for c in sl['cols']:
                for ln, v in (c.get('ev') or {}).items():
                    if flag_of(v) == '!':
                        continue                  # a rejected command is not an event
                    lst = by_ctx.setdefault(ln, [])
                    if text_of(v) not in lst:
                        lst.append(text_of(v))
                    hollow[(ln, text_of(v))] = hollow.get((ln, text_of(v)), True) and flag_of(v) == '~'
    b = Builder(key, 'es', f'{key} · Modules fall out of the wall')
    b.text('title', f'ES {key} · Modules fall out of the wall', 24, 0, 2400, 'title', INK, True)
    intro = CFG['modules_intro']
    b.text('intro', intro, 24, 76, 1800, 'body', BODY)
    per = 2
    head_w = per * SPITCH - 24
    heads = {ctx: f'{ctx} · {len(evs)} event' + ('' if len(evs) == 1 else 's') for ctx, evs in by_ctx.items()}
    head_h = max(lines(h, head_w / 2, 0) for h in heads.values()) * 36 + 20
    x, y0, tallest = 24, 76 + lines(intro, 1800, 0) * 24 + 40 + head_h, 0
    for ctx in sorted(by_ctx, key=lambda n: -len(by_ctx[n])):
        evs = by_ctx[ctx]
        b.text(f'ctx.{ctx}', heads[ctx], x, y0 - head_h, head_w, 'large', INK, True)
        hs = [box_h(t, SW, 96) for t in evs]
        yy = [y0, y0]
        for i, t in enumerate(evs):
            col = i % per
            b.node(f'm.{ctx}.{i}', 'ev', t, x + col * SPITCH, yy[col], SW, hs[i], hollow=hollow[(ctx, t)])
            yy[col] += hs[i] + 16
        tallest = max(tallest, max(yy) - y0)
        x += per * SPITCH + 64
    b.f.update(w=x, h=y0 + tallest + 40)
    return b.f


def legend_em(names, lanes, gaps):
    b = Builder('00', 'em', '00 · Legend and how to read the Event Model')
    W = 1700
    b.text('title', f"{CFG['name']} Event Model", 24, 0, W, 'title', INK, True)
    intro = CFG['legend_em_intro']
    b.text('intro', intro, 24, 76, W - 48, 'body', BODY)
    y = 76 + lines(intro, W - 48, 0) * 24 + 40
    b.text('h.patterns', 'The four slice patterns', 24, y, W, 'large', INK, True); y += 52
    for t, d in [('State Change', 'A screen sends a command; the command records an event, or is rejected.'),
                 ('State View', 'Events feed a read model; a screen (or an agent tool) reads it.'),
                 ('Automation', 'An event lands on a to-do read model; a processor gear reads it and issues a command, which records the next event. With no event to record, the gear calls the outside system itself.'),
                 ('Translation', CFG['translation_text'])]:
        b.text(f'p.{t}', f'**{t}**: {d}', 24, y, W - 48, 'body', TYPE_INK[t]); y += lines(f'{t}: {d}', W - 48, 0) * 24 + 10
    y += 24
    b.text('h.elements', 'Elements', 24, y, W, 'large', INK, True); y += 52
    for kind, label, d, extra in [
        ('screen', 'Screen', 'A page, form, CLI call or admin page, drawn as a plain wireframe.', {}),
        ('gear', '', 'Processor: a listener or scheduled job that acts when nobody clicks. The caption "No event recorded" under a gear means the work, or the call to an outside system, leaves no event behind.', {}),
        ('cmd', 'Command', CFG['em_cmd_desc'], {}),
        ('ev', 'Event', 'Something that happened, past tense, in the lane of the context that owns it.', {}),
        ('ev', 'Change with no event', CFG['em_hollow_desc'], {'hollow': True}),
        ('rej', 'Rejected', 'The command fails with an explicit error; drawn only where the rejection is the point of the slice.', {}),
        ('rm', 'Read model', 'What a screen or a check needs to see.', {}),
        ('todo', 'To do: send the receipt', CFG['em_todo_desc'], {}),
        ('ext', 'External system', CFG['em_ext_desc'], {}),
        ('spec', 'Given / When / Then', 'The business rules of the slice, one card beneath it.', {}),
    ]:
        if kind == 'gear':
            b.node(f'lg.{kind}', 'gear', '', 24 + (BW - GEAR) / 2, y, GEAR, GEAR)
            hh = GEAR
        else:
            hh = box_h(label, BW, 56)
            b.node(f'lg.{kind}.{label}', kind, label, 24, y, BW, hh, **extra)
        b.text(f'lgt.{kind}.{label}', d, 24 + BW + 32, y + 8, W - BW - 80, 'body', BODY)
        y += max(hh, lines(d, W - BW - 80, 0) * 24) + 20
    y += 24
    b.text('h.rows', 'Rows, top to bottom', 24, y, W, 'large', INK, True); y += 52
    rows_t = ('External systems; screens, or a processor gear when nobody clicks; commands; one event lane per context that owns the '
              'events (' + ', '.join(lanes) + '); read models; business rules. A lane is drawn only when the journey touches that context.')
    b.text('rows', rows_t, 24, y, W - 48, 'body', BODY); y += lines(rows_t, W - 48, 0) * 24 + 40
    b.text('h.lines', 'Sections and lines', 24, y, W, 'large', INK, True); y += 52
    lines_t = ('Each section is one slice. The big "S7" above a section is its number; the bold line inside it gives the slice name '
               'and its pattern. A solid grey arrow is the flow. A dashed grey arrow is a call to or from an outside system. On the '
               'walls, a red dashed arrow points from a hot spot to the card it is about. Arrows run in separate tracks between the '
               'columns: follow a line back from its arrowhead to the card it leaves.')
    b.text('lines', lines_t, 24, y, W - 48, 'body', BODY); y += lines(lines_t, W - 48, 0) * 24 + 40
    b.text('h.journeys', 'Journeys', 24, y, W, 'large', INK, True); y += 52
    jt = '\n'.join(f'[{k} · {n}](#em-{k})' for k, n in names)
    b.text('journeys', jt, 24, y, W - 48, 'body', '#1d4ed8'); y += len(names) * 24 + 40
    b.text('h.gaps', CFG['gaps_heading'], 24, y, W, 'large', INK, True); y += 52
    gt = '\n'.join(f'- {g}' for g in gaps)
    b.text('gaps', gt, 24, y, W - 48, 'body', BODY); y += sum(lines(g, W - 60, 0) for g in gaps) * 24 + 40
    b.f.update(w=W, h=y)
    return b.f


def legend_es(names, gaps):
    b = Builder('00', 'es', '00 · Legend and how to read the walls')
    W = 1700
    b.text('title', f"{CFG['name']} Event Storming walls", 24, 0, W, 'title', INK, True)
    intro = CFG['legend_es_intro']
    b.text('intro', intro, 24, 76, W - 48, 'body', BODY)
    y = 76 + lines(intro, W - 48, 0) * 24 + 40
    for kind, label, d in [
        ('ev', 'Event', 'Things that have happened, named in the past tense.'),
        ('evh', 'Change with no event', 'Hollow (white, orange outline): the code changes state without dispatching an event. A command or policy that records nothing at all says "(no event recorded)".'),
        ('rej', 'Rejected', 'A command that fails with an explicit error, drawn where the rejection is the point of the slice.'),
        ('cmd', 'Command', CFG['es_cmd_desc']),
        ('actor', 'Actor', CFG['es_actor_desc']),
        ('ext', 'External system', CFG['es_ext_desc']),
        ('policy', 'Policy', 'When this happens, that should happen. Each policy becomes a listener in the module that reacts.'),
        ('rm', 'Read model', 'What people need to see, or what a check reads at command time.'),
        ('hot', 'Hot spot', CFG['es_hot_desc']),
    ]:
        hh = box_h(label, SW, 96)
        b.node(f'lg.{kind}', 'ev' if kind == 'evh' else kind, label, 24, y, SW, hh, **({'hollow': True} if kind == 'evh' else {}))
        b.text(f'lgt.{kind}', d, 24 + SW + 32, y + 8, W - SW - 80, 'body', BODY)
        y += hh + 20
    y += 24
    b.text('h.walls', 'Walls', 24, y, W, 'large', INK, True); y += 52
    jt = '\n'.join(f'[ES {k} · {n}](#es-{k})' for k, n in names) + '\n[ES 99 · Modules fall out of the wall](#es-99)'
    b.text('walls', jt, 24, y, W - 48, 'body', '#1d4ed8'); y += (len(names) + 1) * 24 + 40
    b.text('h.hot', 'Hot spots', 24, y, W, 'large', INK, True); y += 52
    gt = '\n'.join(f'- {g}' for g in gaps)
    b.text('gaps', gt, 24, y, W - 48, 'body', BODY); y += sum(lines(g, W - 60, 0) for g in gaps) * 24 + 40
    b.f.update(w=W, h=y)
    return b.f


# ------------------------------------------------------------------------------------------------
# Arrow geometry, shared by the page builder and the lint
# ------------------------------------------------------------------------------------------------
def side_pt(n, s):
    x, y, w, h = n['x'], n['y'], n['w'], n['h']
    return {'top': (x + w / 2, y), 'bottom': (x + w / 2, y + h), 'left': (x, y + h / 2), 'right': (x + w, y + h / 2)}[s]


def route_pts(e, nodes):
    a, b = nodes[e['src']], nodes[e['dst']]
    r = e['route']
    p1, p2 = side_pt(a, e['sides'][0]), side_pt(b, e['sides'][1])
    if r[0] == 'straight':
        if abs(p1[0] - p2[0]) < 1:
            return [p1, p2]
        my = (p1[1] + p2[1]) / 2
        return [p1, (p1[0], my), (p2[0], my), p2]
    if r[0] == 'hvh':
        return [p1, (r[1], p1[1]), (r[1], p2[1]), p2]
    if r[0] == 'hvhv':
        return [p1, (r[1], p1[1]), (r[1], r[2]), (p2[0], r[2]), p2]
    if r[0] == 'vhv':
        return [p1, (p1[0], r[1]), (p2[0], r[1]), p2]
    raise ValueError(r)


def _segs(pts):
    return [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]


def _hits_box(s, n, pad=2):
    (x1, y1), (x2, y2) = s
    bx0, by0, bx1, by1 = n['x'] + pad, n['y'] + pad, n['x'] + n['w'] - pad, n['y'] + n['h'] - pad
    if abs(x1 - x2) < 0.5:      # vertical
        return bx0 < x1 < bx1 and max(min(y1, y2), by0) < min(max(y1, y2), by1)
    if abs(y1 - y2) < 0.5:
        return by0 < y1 < by1 and max(min(x1, x2), bx0) < min(max(x1, x2), bx1)
    return False


def lint_frames(frames, want=(), verbose=False):
    """Geometry lint: arrows that run through a card, and lines from different sources that run on top of each
    other (closer than TRACK for more than 12 px). Returns (rows, totals, messages): one row per board
    (key, through, overlap, w, h), a Counter of the totals, and the -v detail lines."""
    tol = TRACK
    tot = collections.Counter()
    rows, msgs = [], []
    for fr in frames:
        for view, fn in (('em', em), ('es', es)):
            key = f'{view}-{fr["key"]}'
            if want and key not in want:
                continue
            f = fn(fr)
            nodes = {n['id']: n for n in f['nodes']}
            boxes = [n for n in f['nodes'] if n['kind'] != 'spec']
            lines_ = []
            through = overlap = 0
            for e in f['edges']:
                pts = route_pts(e, nodes)
                for s in _segs(pts):
                    for n in boxes:
                        if n['id'] in (e['src'], e['dst']):
                            continue
                        if _hits_box(s, n):
                            through += 1
                            if verbose:
                                msgs.append(f'{key} THROUGH {e["src"]} -> {e["dst"]} crosses {n["text"][:40]}')
                    lines_.append((e, s))
            for i in range(len(lines_)):
                ea, (a1, a2) = lines_[i]
                for j in range(i + 1, len(lines_)):
                    eb, (b1, b2) = lines_[j]
                    if (ea['src'] == eb['src'] and ea['dashed'] == eb['dashed']) or ea['dst'] == eb['dst']:
                        continue            # one source fanning out, or one target collecting: reads as a tree
                    av = abs(a1[0] - a2[0]) < 0.5
                    bv = abs(b1[0] - b2[0]) < 0.5
                    ah = abs(a1[1] - a2[1]) < 0.5
                    bh = abs(b1[1] - b2[1]) < 0.5
                    if av and bv and abs(a1[0] - b1[0]) < tol:
                        ov = min(max(a1[1], a2[1]), max(b1[1], b2[1])) - max(min(a1[1], a2[1]), min(b1[1], b2[1]))
                    elif ah and bh and abs(a1[1] - b1[1]) < tol:
                        ov = min(max(a1[0], a2[0]), max(b1[0], b2[0])) - max(min(a1[0], a2[0]), min(b1[0], b2[0]))
                    else:
                        continue
                    if ov > 12:
                        overlap += 1
                        if verbose:
                            msgs.append(f'{key} OVERLAP {nodes[ea["src"]]["text"][:30]} | {nodes[eb["src"]]["text"][:30]} {round(ov)}')
            tot['through'] += through
            tot['overlap'] += overlap
            rows.append((key, through, overlap, f['w'], f['h']))
    return rows, tot, msgs


# ------------------------------------------------------------------------------------------------
# Journey validation
# ------------------------------------------------------------------------------------------------
def validate_frames(frames):
    """Check the journey dicts without drawing them. Returns a list of problem strings (empty when fine)."""
    errs = []
    seen = set()
    for fr in frames:
        key = fr.get('key', '?')
        where = f'journey {key}'
        if key in seen:
            errs.append(f'{where}: key used twice')
        seen.add(key)
        for k in ('key', 'title', 'story', 'lanes', 'slices'):
            if k not in fr:
                errs.append(f'{where}: missing "{k}"')
        if errs and any(e.startswith(where) and 'missing' in e for e in errs):
            continue
        if ' · ' not in fr['title']:
            errs.append(f'{where}: title must read "<key> · <label>"')
        lanes = fr['lanes']
        names = [sl.get('name') for sl in fr['slices']]
        cols = []
        for si, sl in enumerate(fr['slices']):
            sw = f'{where}, slice {si + 1}'
            for k in ('name', 'type', 'cols', 'spec'):
                if k not in sl:
                    errs.append(f'{sw}: missing "{k}"')
            if sl.get('type') not in SLICE_TYPES:
                errs.append(f'{sw}: type {sl.get("type")!r} is not one of {", ".join(SLICE_TYPES)}')
            for c in sl.get('cols', []):
                cols.append(c)
        for k, c in enumerate(cols):
            cw = f'{where}, column {k}'
            for ck in c:
                if ck not in COLUMN_KEYS:
                    errs.append(f'{cw}: unknown key {ck!r} (known: {", ".join(COLUMN_KEYS)})')
            for ln in list(c.get('ev') or {}) + list(c.get('rml') or {}):
                if ln not in lanes:
                    errs.append(f'{cw}: lane {ln!r} is not in the journey lanes')
            refs = [(r, 'from') for r in c.get('from', [])] + [(r, 'rmlfrom') for r in c.get('rmlfrom', [])]
            refs += [(r, 'to') for _, r in c.get('to', [])]
            for r, what in refs:
                try:
                    ck, kind, ln = resolve(r, k, cols, lanes)
                except (KeyError, ValueError, IndexError) as ex:
                    errs.append(f'{cw}: {what} ref {r!r} does not resolve ({ex})')
                    continue
                if not 0 <= ck < len(cols):
                    errs.append(f'{cw}: {what} ref {r!r} points at column {ck}, outside the journey')
                    continue
                tgt = cols[ck]
                has = {'ev': ln in (tgt.get('ev') or {}), 'rml': ln in (tgt.get('rml') or {}),
                       'cmd': 'cmd' in tgt or 'proc' in tgt, 'rm': 'rm' in tgt, 'proc': 'proc' in tgt,
                       'ext': 'ext' in tgt, 'trg': 'trg' in tgt}[kind]
                if not has:
                    errs.append(f'{cw}: {what} ref {r!r} points at column {ck}, which has no {kind}{" in lane " + ln if ln else ""}')
        for h in fr.get('hotspots', []):
            if len(h) != 3:
                errs.append(f'{where}: a hot spot is (slice name, target or None, text); got {h!r}')
            elif h[0] not in names:
                errs.append(f'{where}: hot spot names no slice {h[0]!r}')
    return errs
