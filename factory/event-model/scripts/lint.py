"""Geometry lint of the generated frames: arrows that run through a card, and lines from different sources that run
on top of each other (closer than one arrow track for more than 12 px). Run it after a layout change; both counts should
stay at 0 (a few 20 px stubs where two arrows meet one card side are fine).
Usage: python3 lint.py [--product DIR] [em-05b es-05b ...] [-v]
The product folder is found as in wb.py: --product, else env EVENT_MODEL_PRODUCT, else the current folder."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import model  # noqa: E402


def main(argv):
    folder, args = model.find_product_dir(argv)
    verbose = '-v' in args
    want = [a for a in args if a != '-v']
    _, frames = model.load_product(folder)
    rows, tot, msgs = model.lint_frames(frames, want, verbose)
    if verbose:
        for m in msgs:
            print(m)
    else:
        for key, through, overlap, w, h in rows:
            print(f'{key:7} through={through:3} overlap={overlap:4} w={w} h={h}')
    print(dict(tot))


if __name__ == '__main__':
    main(sys.argv[1:])
