"""Generate and sync the journey whiteboards (claude.ai Whiteboard artifacts).

One board per journey (Event Model frame above, Event Storming wall below) and board 00 with
both legends and the modules wall. Everything comes from the model.py layout engine, so the
boards and the page cannot disagree about content.

People may move, add or delete things on a board. A sync therefore never rebuilds a board: every
generated element has a stable id derived from its content, wb_state.json remembers what was last
published, and a sync writes only what changed in the journeys since then, field by field. Elements
people added (ids not starting with "g") are never touched. Generated elements a person deleted
stay deleted.

The product folder holds product.py (PRODUCT config, FRAMES journey list) and wb_state.json.
Pick it with --product DIR, else env EVENT_MODEL_PRODUCT, else the current folder.

Usage:
  python3 wb.py [--product DIR] check                 validate journeys and boards, write nothing
  python3 wb.py [--product DIR] titles [--missing]    print board keys and titles (to create the boards)
  python3 wb.py [--product DIR] set-url <key> <url>   record the URL of a board you created
  python3 wb.py [--product DIR] plan [key ...]        write <out_dir>/<key>/plan.json: batches of ArtifactData writes
  python3 wb.py [--product DIR] commit <key> [...]    record a board as published once its batches were sent
Before `plan` on a board that already has content, save its live documents with
ArtifactData list (collection "elements", query.limit 1000, out_dir ".wb/<key>/live") and
get board/meta (out_dir ".wb/<key>/live"), so updates and deletes carry if_version.
The doc files go to the product's out_dir (default .wb, gitignored); file paths in the plans are absolute, because
ArtifactData resolves a relative file_path against the calling session's working directory.
"""
import hashlib
import json
import os
import re
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import model  # noqa: E402  (the engine next to this file)

# Set by setup(): the product folder and what it exports.
DIR = OUT = STATE = PAGE_URL = None
FRAMES = []

PAD, GAP = 40, 200
GEAR_SRC = ("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' data-look='clean'>"
            "<path fill='%2357546c' d='M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32"
            "a.5.5 0 0 0-.61-.22l-2.39.96a7 7 0 0 0-1.62-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.84a.5.5 0 0 0-.49.42l-.36 2.54"
            "c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.61.22L2.67 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.07.63-.07.94"
            "s.03.63.07.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.3.61.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54"
            "c.05.24.25.42.49.42h3.84c.24 0 .45-.18.49-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.48 0 .61-.22"
            "l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z'/></svg>")


def setup(folder):
    """Load the product from FOLDER and set the paths the commands use."""
    global DIR, OUT, STATE, PAGE_URL, FRAMES
    product, FRAMES = model.load_product(folder)
    DIR = folder
    OUT = os.path.abspath(os.path.join(DIR, model.CFG['out_dir']))
    STATE = os.path.join(DIR, 'wb_state.json')
    PAGE_URL = model.CFG['page_url'] or ''


def load_state():
    """wb_state.json, or an empty state when the file is missing or holds {}."""
    st = json.load(open(STATE)) if os.path.exists(STATE) else {}
    st.setdefault('boards', {})
    return st


def gid(board, sem):
    return 'g' + hashlib.sha1(f'{board}|{sem}'.encode()).hexdigest()[:10]


def board_parts():
    """{board key: (title, [model frames side by side])}: 00 holds both legends and ES 99."""
    names = [(fr['key'], fr['title'].split(' · ', 1)[1]) for fr in FRAMES]
    gaps = [f'{fr["key"]} · {h[2]}' for fr in FRAMES for h in fr.get('hotspots', [])]
    lanes = list(dict.fromkeys(part for fr in FRAMES for ln in fr['lanes'] for part in ln.split(' / ')))
    parts = {'00': ('Event Model 00 · Legend and modules',
                    [model.legend_em(names, lanes, gaps), model.legend_es(names, gaps), model.modules(FRAMES)])}
    for fr in FRAMES:
        label = fr['title'].split(' · ', 1)[1]
        parts[f'em-{fr["key"]}'] = (f'Event Model {fr["key"]} · {label}', [model.em(fr)])
        parts[f'es-{fr["key"]}'] = (f'Event Storming {fr["key"]} · {label}', [model.es(fr)])
    return parts


def links_to_urls(text, urls):
    def a(m):
        label, href = m.group(1), m.group(2)
        if href.startswith('#'):
            view, key = href[1:].split('-', 1)
            url = urls.get(f'{view}-{key}') or urls.get('00')
            return f'[{label}]({url})' if url else label
        return m.group(0)
    return re.sub(r'\[([^\]]+)\]\((#[\w-]+|https://[^)\s]+)\)', a, text)


def safe(text):
    return text.replace('*', '\u2217') if '**' not in text else text


def build_board(key, title, frames, urls):
    els, order_sec, order_rest, order_arrows = {}, [], [], []
    seen = {}

    def add(sem, el, bucket):
        n = seen.get(sem, 0)
        seen[sem] = n + 1
        i = gid(key, f'{sem}|{n}')
        els[i] = el
        bucket.append(i)
        return i

    note = model.CFG['board_note'].replace('{page_url}', PAGE_URL) if PAGE_URL else model.CFG['board_note_no_page']
    add('note', {'type': 'text', 'x': 24, 'y': -120, 'text': note, 'size': 'body', 'wrap': 900, 'color': model.MUTED}, order_rest)
    cx = 980
    if key != '00' and urls.get('00'):
        add('link-00', {'type': 'link', 'x': cx, 'y': -130, 'href': urls['00'], 'title': 'Event Model 00 · Legend and modules', 'kind': 'whiteboard'}, order_rest)
        cx += 344
    if key.startswith(('em-', 'es-')):
        other = ('es-' if key.startswith('em-') else 'em-') + key[3:]
        if urls.get(other):
            add('link-other', {'type': 'link', 'x': cx, 'y': -130, 'href': urls[other],
                               'title': ('Event Storming ' if other.startswith('es') else 'Event Model ') + key[3:], 'kind': 'whiteboard'}, order_rest)
    if key == '00':
        y = 0
        for k in sorted(urls):
            if k != '00':
                kind, jk = k.split('-', 1)
                add(f'link-{k}', {'type': 'link', 'x': -380, 'y': y, 'href': urls[k],
                                  'title': ('Event Model ' if kind == 'em' else 'Event Storming ') + jk, 'kind': 'whiteboard'}, order_rest)
                y += 72
    ox = 0
    for f in frames:
        v = f['view'] + f['key']
        sem_of = {}
        for s in f['slices']:
            # The board draws a section title at a fixed screen size, so a long one is cut or hidden on a narrow
            # slice and covers the story when zoomed out. The section shows only "S7"; the full title sits inside.
            # The id stays on the full title, so existing sections are updated, not recreated.
            short = 'S' + str(int(s['id'][1:]) + 1)
            add(f'{v}|slice|{s["text"]}', {'type': 'container', 'x': ox + s['x'] - 8, 'y': s['y'] + 30, 'w': s['w'] + 16,
                                           'h': s['h'] - 30, 'text': short, 'color': 'white'}, order_sec)
            add(f'{v}|slicelabel|{s["text"]}', {'type': 'text', 'x': ox + s['x'] + 4, 'y': s['y'] + 42, 'text': safe(f'**{s["text"]}**'),
                                                'size': 'small', 'wrap': s['w'] - 8, 'color': model.TYPE_INK[s['type']]}, order_rest)
        for n in f['nodes']:
            sem = f'{v}|{n["kind"]}|{n["text"]}'
            if n['kind'] == 'gear':
                sem = f'{v}|gear|{n["id"]}'
                i = add(sem, {'type': 'image', 'x': ox + n['x'], 'y': n['y'], 'w': n['w'], 'h': n['h'], 'by': 'claude', 'src': GEAR_SRC}, order_rest)
            else:
                fill, stroke = model.PAL[n['kind']]
                el = {'type': 'shape', 'kind': 'rect' if n['kind'] == 'screen' else 'rounded', 'x': ox + n['x'], 'y': n['y'],
                      'w': n['w'], 'h': n['h'], 'text': safe(links_to_urls(n['text'], urls)), 'size': 'small', 'color': fill, 'stroke': stroke}
                if n.get('hollow'):
                    el['hollow'] = True
                if n['kind'] == 'spec':
                    el['textAlign'] = 'left'
                i = add(sem, el, order_rest)
            sem_of[n['id']] = (i, sem)
        for t in f['texts']:
            text = links_to_urls(t['text'], urls)
            if t['bold'] and '\n' not in text and '](' not in text:
                text = f'**{text}**'
            add(f'{v}|text|{t["text"][:300]}', {'type': 'text', 'x': ox + t['x'], 'y': t['y'], 'text': safe(text), 'size': t['size'],
                                               'wrap': t['w'], 'color': t['color']}, order_rest)
        nodes = {n['id']: n for n in f['nodes']}
        for e in f['edges']:
            a, b = nodes[e['src']], nodes[e['dst']]
            acx, acy = a['x'] + a['w'] / 2, a['y'] + a['h'] / 2
            bcx, bcy = b['x'] + b['w'] / 2, b['y'] + b['h'] / 2
            el = {'type': 'arrow', 'from': sem_of[e['src']][0], 'to': sem_of[e['dst']][0], 'color': e.get('color', model.ARROW), 'head': 'end'}
            r = e['route']
            if r[0] == 'straight':
                el['fromSide'], el['toSide'] = e['sides']
            elif r[0] == 'hvh':
                el['bends'] = ['h', round(r[1] - acx)]
            elif r[0] == 'hvhv':
                el['bends'] = ['h', round(r[1] - acx), round(r[2] - bcy)]
            elif r[0] == 'vhv':
                el['bends'] = ['v', round(r[1] - acy)]
            if e['dashed']:
                el['dash'] = True
            add(f'{v}|arrow|{sem_of[e["src"]][1]}|{sem_of[e["dst"]][1]}', el, order_arrows)
        ox += f['w'] + GAP
    order = order_sec + order_rest + order_arrows
    return els, order, []


def h(el):
    return hashlib.sha1(json.dumps(el, sort_keys=True).encode()).hexdigest()


def live_docs(key):
    d = os.path.join(OUT, key, 'live')
    live = {}
    for root, _, files in os.walk(d):
        for f in files:
            if f.endswith('.json'):
                doc = json.load(open(os.path.join(root, f)))
                live[os.path.join(os.path.relpath(root, d), f[:-5])] = doc
    return live


def version_of(doc):
    for k in ('version', '__version__', '_version'):
        if isinstance(doc, dict) and k in doc:
            return doc[k]
    return None


def plan(keys):
    st = load_state()
    urls = {k: b['url'] for k, b in st['boards'].items() if b.get('url')}
    parts = board_parts()
    for key in keys or sorted(parts):
        b = st['boards'].get(key)
        if not b or not b.get('url'):
            print(f'{key}: no board url in wb_state.json, skipped')
            continue
        title, frames = parts[key]
        els, order, grown = build_board(key, title, frames, urls)
        if len(els) > 780:
            raise SystemExit(f'{key}: {len(els)} elements, over the 800 a board allows (keep room for people)')
        pub = b.get('published', {})
        vers = b.get('versions', {})
        live = live_docs(key)
        d = os.path.join(OUT, key)
        os.makedirs(os.path.join(d, 'docs'), exist_ok=True)
        writes, skipped = [], []

        def write_doc(name, data):
            p = os.path.join(d, 'docs', f'{name}.json')
            json.dump(data, open(p, 'w'), ensure_ascii=False, separators=(',', ':'))
            return os.path.abspath(p)  # ArtifactData resolves relative paths against the caller's cwd

        for i, el in els.items():
            ldoc = live.get(os.path.join('elements', i))
            if i not in pub:
                if ldoc is None:
                    writes.append({'op': 'set', 'collection': 'elements', 'doc_id': i, 'file_path': write_doc(i, el)})
                continue
            if h(pub[i]) == h(el):
                continue
            if ldoc is None and (live or i not in vers):
                skipped.append(i)  # the fresh read shows a person deleted it: leave it deleted
                continue
            changed = {k: v for k, v in el.items() if pub[i].get(k) != v}
            changed.update({k: {'__delete__': True} for k in pub[i] if k not in el})
            writes.append({'op': 'update', 'collection': 'elements', 'doc_id': i, 'file_path': write_doc(i, changed),
                           'if_version': version_of(ldoc) or vers.get(i)})
        gone = [i for i in pub if i not in els]
        for i in gone:
            ldoc = live.get(os.path.join('elements', i))
            if ldoc is not None or (not live and i in vers):
                writes.append({'op': 'delete', 'collection': 'elements', 'doc_id': i, 'if_version': version_of(ldoc) or vers.get(i)})
        meta = live.get(os.path.join('board', 'meta'))
        if meta is None and 'meta' in vers:
            meta = {'order': b.get('order', [])}
        new_ids = [i for i in order if i not in pub]
        if meta is None:
            mdata = {'v': 1, 'title': title, 'order': order}
            mw = {'op': 'set', 'collection': 'board', 'doc_id': 'meta', 'file_path': write_doc('meta', mdata)}
        elif new_ids or gone:
            old = [i for i in meta.get('order', []) if i not in gone]
            secs = [i for i in new_ids if els[i]['type'] == 'container']
            rest = [i for i in new_ids if els[i]['type'] != 'container']
            mdata = {'title': title, 'order': secs + old + rest}
            mw = {'op': 'update', 'collection': 'board', 'doc_id': 'meta', 'file_path': write_doc('meta', mdata),
                  'if_version': version_of(meta) or vers.get('meta')}
        else:
            mw = None
        if mw and meta is None:
            writes.insert(0, mw)
        elif mw:
            writes.append(mw)
        if not pub:  # first fill: back to front, as the board type asks
            pos = {i: n for n, i in enumerate(order)}
            writes.sort(key=lambda w: -1 if w['collection'] == 'board' else pos.get(w['doc_id'], 0))
        for w in writes:
            if w.get('if_version') is None:
                w.pop('if_version', None)
        batches = [writes[n:n + 50] for n in range(0, len(writes), 50)]
        missing = [w['doc_id'] for w in writes if w['op'] != 'set' and 'if_version' not in w]
        if missing:
            raise SystemExit(f'{key}: no version known for {missing[:5]}; read the board into .wb/{key}/live first')
        json.dump({'url': b['url'], 'batches': batches, 'elements': els, 'order': order}, open(os.path.join(d, 'plan.json'), 'w'),
                  ensure_ascii=False, separators=(',', ':'))
        print(f'{key}: {len(els)} elements, {len(writes)} writes in {len(batches)} batches'
              + (f', {len(skipped)} deleted on the board and left deleted' if skipped else '')
              + (f', {len(grown)} boxes may be drawn larger than planned' if grown else ''))


def commit(keys):
    st = load_state()
    for key in keys:
        p = json.load(open(os.path.join(OUT, key, 'plan.json')))
        b = st['boards'][key]
        vers = b.setdefault('versions', {})
        for batch in p['batches']:
            for w in batch:
                i = w['doc_id']
                if w['op'] == 'delete':
                    vers.pop(i, None)
                elif w['op'] == 'set':
                    vers[i] = 1
                else:
                    vers[i] = w['if_version'] + 1
        b['published'] = p['elements']
        b['order'] = p['order']
        shutil.rmtree(os.path.join(OUT, key, 'live'), ignore_errors=True)  # a board read is stale once the board changed
        print(f'{key}: recorded {len(p["elements"])} elements as published')
    json.dump(st, open(STATE, 'w'), ensure_ascii=False, separators=(',', ':'), sort_keys=True)


def titles(args):
    st = load_state()
    have = {k for k, b in st['boards'].items() if b.get('url')}
    for k, (t, _) in sorted(board_parts().items()):
        if '--missing' in args and k in have:
            continue
        print(k, t)


def set_url(args):
    if len(args) != 2:
        raise SystemExit('usage: set-url <key> <url>')
    key, url = args
    if key not in board_parts():
        raise SystemExit(f'unknown board key {key!r}; run titles to list the keys')
    if not url.startswith('https://'):
        raise SystemExit('the url must start with https://')
    st = load_state()
    st['boards'].setdefault(key, {})['url'] = url
    json.dump(st, open(STATE, 'w'), ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    print(f'{key}: url recorded')


def check():
    """Validate without writing anything or needing board URLs."""
    errs = model.validate_frames(FRAMES)
    if errs:
        print('journey problems:')
        for e in errs:
            print('  ' + e)
        raise SystemExit(1)
    problems = []
    try:
        parts = board_parts()
        for key, (title, frames) in sorted(parts.items()):
            els, _, _ = build_board(key, title, frames, {})
            if len(els) > 780:
                problems.append(f'{key}: {len(els)} elements, over the 800 a board allows (keep room for people)')
    except (KeyError, ValueError, IndexError) as ex:
        raise SystemExit(f'build failed: {type(ex).__name__}: {ex}')
    rows, tot, _ = model.lint_frames(FRAMES)
    for key, through, overlap, _, _ in rows:
        if through or overlap:
            problems.append(f'{key}: {through} arrows run through a card, {overlap} lines overlap (run lint.py -v for detail)')
    if problems:
        print('board problems:')
        for p in problems:
            print('  ' + p)
        raise SystemExit(1)
    print(f'ok: {len(FRAMES)} journeys, {len(parts)} boards, no arrow through a card, no overlapping lines')


def main(argv):
    folder, args = model.find_product_dir(argv)
    if not args:
        raise SystemExit(__doc__)
    cmd, args = args[0], args[1:]
    setup(folder)
    if cmd == 'titles':
        titles(args)
    elif cmd == 'plan':
        plan(args)
    elif cmd == 'commit':
        commit(args)
    elif cmd == 'check':
        check()
    elif cmd == 'set-url':
        set_url(args)
    else:
        raise SystemExit(f'unknown command {cmd!r}\n\n{__doc__}')


if __name__ == '__main__':
    main(sys.argv[1:])
