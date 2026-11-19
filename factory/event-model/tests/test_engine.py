"""Tests for the event-model engine. Standard library only.

Run from the repository root:
  python3 -m unittest discover -s factory/event-model/tests
"""
import glob
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
WB = os.path.join(SKILL, 'scripts', 'wb.py')
SAMPLE = os.path.join(SKILL, 'examples', 'sample-product')
NO_SLICES = 'No slices yet. The first feature in this journey adds them.'
BOARDS = ('00', 'em-01', 'es-01')

EMPTY_JOURNEY = '''J01 = dict(
    key='01', title='01 · Repair booking',
    story='Story: a customer books a repair.',
    lanes=[], slices=[], hotspots=[],
)
'''


def wb(folder, *args):
    env = dict(os.environ)
    env.pop('EVENT_MODEL_PRODUCT', None)
    return subprocess.run([sys.executable, WB, '--product', folder, *args], capture_output=True, text=True, env=env)


class EngineTest(unittest.TestCase):
    def product(self):
        folder = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, folder, True)
        shutil.copytree(SAMPLE, folder, dirs_exist_ok=True)
        state = os.path.join(folder, 'wb_state.json')
        if os.path.exists(state):
            os.remove(state)
        return folder

    def write_journey(self, folder, source):
        with open(os.path.join(folder, 'j01.py'), 'w', encoding='utf-8') as f:
            f.write(source)

    def test_sample_passes_check(self):
        r = wb(self.product(), 'check')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('ok:', r.stdout)

    def test_empty_journey_passes_check(self):
        folder = self.product()
        self.write_journey(folder, EMPTY_JOURNEY)
        r = wb(folder, 'check')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertIn('ok: 1 journeys, 3 boards', r.stdout)

    def test_empty_journey_plans_placeholder_boards(self):
        folder = self.product()
        self.write_journey(folder, EMPTY_JOURNEY)
        for key in BOARDS:
            r = wb(folder, 'set-url', key, f'https://example.invalid/SAMPLE-{key}')
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        r = wb(folder, 'plan')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        out = os.path.join(folder, '.wb')
        for key in ('em-01', 'es-01'):
            texts = []
            for path in glob.glob(os.path.join(out, key, 'docs', '*.json')):
                with open(path, encoding='utf-8') as f:
                    texts.append(json.dumps(json.load(f)))
            blob = '\n'.join(texts)
            self.assertIn(NO_SLICES, blob, key)
            self.assertIn('Repair booking', blob, key)
            self.assertIn('a customer books a repair', blob, key)
        self.assertTrue(os.path.exists(os.path.join(out, '00', 'plan.json')))

    def test_broken_journey_fails_check(self):
        folder = self.product()
        with open(os.path.join(SAMPLE, 'j01.py'), encoding='utf-8') as f:
            source = f.read()
        self.assertIn("'-1.Booking'", source)
        self.write_journey(folder, source.replace("'-1.Booking'", "'-1.Nowhere'"))
        r = wb(folder, 'check')
        self.assertNotEqual(r.returncode, 0, r.stdout + r.stderr)


if __name__ == '__main__':
    unittest.main()
