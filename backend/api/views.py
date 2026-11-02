from rest_framework import viewsets, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Artist, Event, ArtistEventAllocation, Ticket
from .serializers import ArtistEventAllocationSerializer, TicketSerializer, EventSerializer, ArtistSerializer

class AllocationViewSet(viewsets.ModelViewSet):
    queryset = ArtistEventAllocation.objects.all()
    serializer_class = ArtistEventAllocationSerializer

@api_view(['POST'])
def record_cash_sale(request, allocation_id):
    allocation = get_object_or_404(ArtistEventAllocation, id=allocation_id)
    amount = int(request.data.get('amount', 1))
    
    tickets = []
    for _ in range(amount):
        ticket = Ticket.objects.create(allocation=allocation, ticket_type='CASH')
        tickets.append(ticket)
        allocation.cash_tickets_sold += 1
    
    allocation.save()
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
