from django.contrib import admin
from .models import Artist, Event, ArtistEventAllocation, Ticket

admin.site.register(Artist)
admin.site.register(Event)
admin.site.register(ArtistEventAllocation)
admin.site.register(Ticket)
