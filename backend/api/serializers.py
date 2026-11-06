from rest_framework import serializers
from .models import Artist, Event, ArtistEventAllocation, Ticket

class TicketSerializer(serializers.ModelSerializer):
    short_code = serializers.SerializerMethodField()
    artist_name = serializers.CharField(source='allocation.artist.name', read_only=True)
    event_title = serializers.CharField(source='allocation.event.title', read_only=True)
    venue_name = serializers.CharField(source='allocation.event.venue_name', read_only=True)
    event_date = serializers.DateTimeField(source='allocation.event.date', read_only=True)
    custom_message = serializers.CharField(source='allocation.event.custom_message', read_only=True)
    theme_color = serializers.CharField(source='allocation.event.theme_color', read_only=True)
    background_image_url = serializers.CharField(source='allocation.event.background_image_url', read_only=True)

    def get_short_code(self, obj):
        return str(obj.id)[:8].upper()

    class Meta:
        model = Ticket
        fields = '__all__'

class ArtistSerializer(serializers.ModelSerializer):
    class Meta:
        model = Artist
        fields = '__all__'

class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = '__all__'

class ArtistEventAllocationSerializer(serializers.ModelSerializer):
    artist_name = serializers.CharField(source='artist.name', read_only=True)
    event_title = serializers.CharField(source='event.title', read_only=True)
    event_date = serializers.DateTimeField(source='event.date', read_only=True)
    venue_name = serializers.CharField(source='event.venue_name', read_only=True)
    theme_color = serializers.CharField(source='event.theme_color', read_only=True)
    background_image_url = serializers.CharField(source='event.background_image_url', read_only=True)
    custom_message = serializers.CharField(source='event.custom_message', read_only=True)
    event_id = serializers.IntegerField(source='event.id', read_only=True)
    total_sold = serializers.IntegerField(read_only=True)
    artist_slug = serializers.CharField(source='artist.slug', read_only=True)

    class Meta:
        model = ArtistEventAllocation
        fields = '__all__'
