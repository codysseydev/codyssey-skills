"""Journey 01: a customer books a repair, the mechanic finishes it, the customer is told.

A journey is a dict:
  key, title ("<key> · <label>"), story, lanes (one per bounded context), slices, hotspots.
A slice is name, type (State Change, State View, Automation or Translation), cols, spec.
A column is one step in time. See references/journey-format.md for every key a column takes.
"""
J01 = dict(
    key='01', title='01 · Repair booking',
    story='Story: a customer books a repair for their bike through the booking form. A mechanic marks the repair finished in the workshop tool. The customer then gets a text that the bike is ready, and can see all their bookings on one page.',
    lanes=['Booking', 'Workshop'],
    slices=[
        dict(name='Book a repair', type='State Change', cols=[
            dict(trg='Booking form: bike, problem, drop-off day', cmd='Book a repair', actor='Customer',
                 ev={'Booking': 'Repair booked'}),
        ], spec=[
            'Given a customer fills in the bike, a short problem description and a drop-off day',
            'When they send the form',
            'Then the repair is recorded as booked',
            '',
            'Given the drop-off day is in the past',
            'Then the booking is rejected',
        ]),
        dict(name='See my bookings', type='State View', cols=[
            dict(trg='My bookings page', rm='Open bookings: bike, drop-off day, status', actor='Customer',
                 **{'from': ['-1.Booking']}),
        ], spec=[
            'Given a customer has booked repairs',
            'When they open the bookings page',
            'Then they see each booking with its drop-off day and whether the bike is ready',
        ]),
        dict(name='Finish a repair', type='State Change', cols=[
            dict(trg='Workshop tool: repair list', cmd='Mark the repair finished', actor='Mechanic',
                 ev={'Workshop': 'Repair finished'}),
        ], spec=[
            'Given a repair is booked',
            'When the mechanic marks it finished',
            'Then the repair is recorded as finished',
        ]),
        dict(name='Tell the customer', type='Automation', cols=[
            dict(proc='Text the customer that the bike is ready', **{'from': ['-1.Workshop']},
                 ext='SMS gateway: send the text'),
        ], spec=[
            'Given a repair was finished',
            'Then, by automation: the customer gets a text with the shop opening hours',
            'No event is recorded; the gateway call is the whole effect',
        ]),
    ],
    hotspots=[('Tell the customer', 'text the customer', 'A customer with no phone number is never told')],
)
