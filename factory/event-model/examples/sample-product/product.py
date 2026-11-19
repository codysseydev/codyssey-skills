"""Sample product: a bike repair shop's booking system. Copy this folder into your brain and replace the journeys.

product.py exports two things the event-model scripts read:
  PRODUCT  config: names and legend wording. Anything left out falls back to the defaults in scripts/model.py.
  FRAMES   the journeys, in the order they should appear on board 00 (legends and the modules wall).
"""
from j01 import J01

# Each journey carries its own hot spots. A hot spot is (slice name, target text or None, text).
FRAMES = [J01]

PRODUCT = {
    'name': 'Bike Shop',
    'default_actor': 'Customer',
    'scheduler_actor': 'Scheduler',
    'out_dir': '.wb',                   # working folder for plans and board reads, relative to this folder; gitignore it
    'page_url': '',                     # claude.ai artifact of a read-only page, if the product has one; empty means no link
    'es_actor_desc': 'People or systems that issue commands: Customer, Mechanic, Scheduler.',
    'es_ext_desc': 'Things outside the shop that take part: the SMS gateway.',
}
