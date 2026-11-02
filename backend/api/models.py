from django.db import models
import uuid

class Artist(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)

    def __str__(self):
        return self.name

class Event(models.Model):
    title = models.CharField(max_length=200)
    date = models.DateTimeField()
    venue_name = models.CharField(max_length=200)
    theme_color = models.CharField(max_length=20, default="#1a1a1a")
    background_image_url = models.URLField(blank=True, null=True, default="https://images.unsplash.com/photo-1540039155733-d7fbc999e347?auto=format&fit=crop&q=80&w=1000")
    custom_message = models.TextField(blank=True, null=True, default="General Admission")

    def __str__(self):
        return f"{self.title} @ {self.venue_name}"

class ArtistEventAllocation(models.Model):
    artist = models.ForeignKey(Artist, on_delete=models.CASCADE)
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    ticket_goal = models.PositiveIntegerField(default=50)
    cash_tickets_sold = models.PositiveIntegerField(default=0)
    digital_tickets_sold = models.PositiveIntegerField(default=0)

    def total_sold(self):
        return self.cash_tickets_sold + self.digital_tickets_sold

    def __str__(self):
        return f"{self.artist.name} allocation for {self.event.title}"

class Ticket(models.Model):
    TICKET_TYPES = (
        ('DIGITAL', 'Digital'),
        ('CASH', 'Cash')
    )
    STATUS_CHOICES = (
        ('VALID', 'Valid'),
        ('SCANNED', 'Scanned'),
        ('REVOKED', 'Revoked')
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    allocation = models.ForeignKey(ArtistEventAllocation, on_delete=models.CASCADE, related_name='tickets')
    ticket_type = models.CharField(max_length=10, choices=TICKET_TYPES, default='DIGITAL')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='VALID')
    buyer_email = models.EmailField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Ticket {self.id} - {self.status}"
