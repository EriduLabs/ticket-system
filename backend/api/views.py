from rest_framework import viewsets, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Artist, Event, ArtistEventAllocation, Ticket
from .serializers import ArtistEventAllocationSerializer, TicketSerializer, EventSerializer, ArtistSerializer
import jwt
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags

class AllocationViewSet(viewsets.ModelViewSet):
    queryset = ArtistEventAllocation.objects.all()
    serializer_class = ArtistEventAllocationSerializer

@api_view(['POST'])
def record_cash_sale(request, allocation_id):
    allocation = get_object_or_404(ArtistEventAllocation, id=allocation_id)
    amount = int(request.data.get('amount', 1))
    email = request.data.get('email')
    
    tickets = []
    for _ in range(amount):
        ticket = Ticket.objects.create(
            allocation=allocation, 
            ticket_type='CASH',
            buyer_email=email
        )
        tickets.append(ticket)
        allocation.cash_tickets_sold += 1
    
    allocation.save()

    # Send Email Receipt if email provided
    if email:
        try:
            subject = f"Your Tickets for {allocation.event.title}"
            html_content = f"""
            <h2>You're going to see {allocation.artist.name}!</h2>
            <p>Your {amount} cash ticket(s) have been securely logged.</p>
            <p><strong>Venue:</strong> {allocation.event.venue_name}</p>
            <p>Save this email. Here are your ticket IDs:</p>
            <ul>
                {"".join([f"<li>Ticket ID: {t.id}</li>" for t in tickets])}
            </ul>
            """
            text_content = strip_tags(html_content)
            msg = EmailMultiAlternatives(subject, text_content, 'noreply@ticketflow.com', [email])
            msg.attach_alternative(html_content, "text/html")
            msg.send()
        except Exception as e:
            print(f"Email sending failed (Is SMTP configured in settings.py?): {e}")

    return Response({
        'allocation': ArtistEventAllocationSerializer(allocation).data,
        'tickets': TicketSerializer(tickets, many=True).data
    })

@api_view(['POST'])
def record_digital_sale(request, allocation_id):
    allocation = get_object_or_404(ArtistEventAllocation, id=allocation_id)
    amount = int(request.data.get('amount', 1))
    
    tickets = []
    for _ in range(amount):
        ticket = Ticket.objects.create(allocation=allocation, ticket_type='DIGITAL')
        tickets.append(ticket)
        allocation.digital_tickets_sold += 1
        
    allocation.save()
    return Response({
        'allocation': ArtistEventAllocationSerializer(allocation).data,
        'tickets': TicketSerializer(tickets, many=True).data
    })

@api_view(['GET'])
def get_allocation_by_slug(request, slug):
    allocation = get_object_or_404(ArtistEventAllocation, artist__slug=slug)
    return Response(ArtistEventAllocationSerializer(allocation).data)

@api_view(['GET', 'PATCH'])
def event_detail(request, event_id):
    event = get_object_or_404(Event, id=event_id)
    if request.method == 'PATCH':
        serializer = EventSerializer(event, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    return Response(EventSerializer(event).data)

@api_view(['GET', 'PATCH'])
def artist_detail(request, artist_id):
    artist = get_object_or_404(Artist, id=artist_id)
    if request.method == 'PATCH':
        serializer = ArtistSerializer(artist, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    return Response(ArtistSerializer(artist).data)

@api_view(['POST'])
def scan_ticket(request, ticket_id):
    try:
        ticket = Ticket.objects.get(id=ticket_id)
        if ticket.status == 'SCANNED':
            return Response({'success': False, 'message': 'Ticket has already been scanned!'}, status=status.HTTP_400_BAD_REQUEST)
        elif ticket.status == 'REVOKED':
            return Response({'success': False, 'message': 'Ticket has been revoked!'}, status=status.HTTP_400_BAD_REQUEST)
        
        ticket.status = 'SCANNED'
        ticket.save()
        return Response({'success': True, 'message': 'Ticket successfully scanned!', 'ticket': str(ticket.id)})
    except Ticket.DoesNotExist:
        return Response({'success': False, 'message': 'Ticket not found.'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
def generate_google_wallet_jwt(request, ticket_id):
    ticket = get_object_or_404(Ticket, id=ticket_id)
    allocation = ticket.allocation

    # Create the Google Wallet Object Payload
    # This uses the new Google Wallet API specification
    claims = {
        "iss": settings.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL,
        "aud": "google",
        "typ": "savetowallet",
        "iat": 1600000000,
        "payload": {
            "genericObjects": [{
                "id": f"{settings.GOOGLE_WALLET_ISSUER_ID}.{ticket.id}",
                "classId": f"{settings.GOOGLE_WALLET_ISSUER_ID}.general_admission_class",
                "genericType": "GENERIC_TYPE_UNSPECIFIED",
                "hexBackgroundColor": allocation.event.theme_color,
                "logo": {
                    "sourceUri": {
                        "uri": "https://example.com/logo.png"
                    }
                },
                "cardTitle": {
                    "defaultValue": {
                        "language": "en",
                        "value": allocation.event.title
                    }
                },
                "subheader": {
                    "defaultValue": {
                        "language": "en",
                        "value": allocation.artist.name
                    }
                },
                "header": {
                    "defaultValue": {
                        "language": "en",
                        "value": allocation.custom_message
                    }
                },
                "barcode": {
                    "type": "QR_CODE",
                    "value": str(ticket.id),
                    "alternateText": str(ticket.id)[:8]
                }
            }]
        }
    }

    # In production, this must be signed with your service account's PRIVATE_KEY
    # For MVP, we are generating the payload structure
    mock_token = jwt.encode(claims, 'mock_secret_key', algorithm='HS256')

    return Response({
        "save_url": f"https://pay.google.com/gp/v/save/{mock_token}",
        "jwt": mock_token
    })
