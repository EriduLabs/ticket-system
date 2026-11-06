from rest_framework import viewsets, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from .models import Artist, Event, ArtistEventAllocation, Ticket
from .serializers import ArtistEventAllocationSerializer, TicketSerializer, EventSerializer, ArtistSerializer
import json
import os
import re
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import jwt
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.storage import default_storage
from django.core.mail import EmailMultiAlternatives
from django.http import HttpResponse, HttpResponseRedirect
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.html import strip_tags
from django.utils.text import slugify

class AllocationViewSet(viewsets.ModelViewSet):
    queryset = ArtistEventAllocation.objects.all()
    serializer_class = ArtistEventAllocationSerializer

def _get_public_base_url(request=None):
    # Re-read backend/.env dynamically so tunnel URL updates take effect immediately without restart
    env_file = settings.BASE_DIR / '.env'
    if env_file.exists():
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('PUBLIC_BASE_URL='):
                    val = line.split('=', 1)[1].strip().rstrip('/')
                    if val:
                        return val
    env_url = os.environ.get('PUBLIC_BASE_URL', '').strip().rstrip('/')
    if env_url:
        return env_url
    if request is not None:
        fwd_host = request.META.get('HTTP_X_FORWARDED_HOST') or request.get_host()
        fwd_proto = request.META.get('HTTP_X_FORWARDED_PROTO') or ('https' if request.is_secure() else 'http')
        if fwd_host and not any(h in fwd_host for h in ('localhost', '127.0.0.1')):
            return f"{fwd_proto}://{fwd_host}"
    return f"http://{_get_lan_ip()}:5173"


def _send_ticket_confirmation_email(allocation, tickets, email, request=None):
    if not email:
        return {"sent": False, "reason": "No email provided"}

    public_base = _get_public_base_url(request)
    event_date_str = (
        allocation.event.date.strftime("%a, %b %d, %Y at %I:%M %p")
        if allocation.event.date
        else "TBD"
    )

    ticket_items_html = []
    for t in tickets:
        short_code = str(t.id)[:8].upper()
        # Short HTTPS redirect URL that Gmail mobile never truncates, which 302-redirects to pay.google.com/gp/v/save/<jwt>
        wallet_redirect_url = f"{public_base}/api/tickets/{t.id}/google-wallet/redirect/?allocation_id={allocation.id}"
        wallet_link_html = (
            f'<div style="margin:16px 0;">'
            f'<a href="{wallet_redirect_url}" target="_blank" '
            f'style="display:inline-block;background:#1a73e8;color:#ffffff;padding:12px 24px;'
            f'border-radius:24px;text-decoration:none;font-weight:700;font-size:15px;">'
            f'＋ Add Ticket #{short_code} to Google Wallet</a>'
            f'</div>'
        )

        qr_img_url = f"https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data={t.id}"
        checkin_url = f"{public_base}/api/tickets/{t.id}/check-in/"

        ticket_items_html.append(
            f'<div style="background:#1e1e1e;border:1px solid #333;border-radius:12px;padding:18px;margin-bottom:16px;text-align:center;">'
            f'<div style="font-size:13px;color:#ff2a85;font-weight:700;letter-spacing:1px;text-transform:uppercase;">'
            f'{allocation.event.custom_message or "General Admission"}'
            f'</div>'
            f'<div style="font-size:20px;font-weight:800;margin:6px 0;color:#fff;">Ticket #{short_code}</div>'
            f'<div style="font-size:12px;color:#aaa;margin-bottom:14px;">UUID: <code>{t.id}</code></div>'
            f'<div style="background:#ffffff;display:inline-block;padding:10px;border-radius:10px;">'
            f'<img src="{qr_img_url}" alt="Ticket QR {short_code}" width="180" height="180" style="display:block;" />'
            f'</div>'
            f'{wallet_link_html}'
            f'<div style="margin-top:10px;">'
            f'<a href="{checkin_url}" target="_blank" '
            f'style="display:inline-block;background:#00c853;color:#ffffff;padding:9px 18px;'
            f'border-radius:18px;text-decoration:none;font-weight:600;font-size:13px;">'
            f'✓ Tap to Check In Ticket #{short_code}</a>'
            f'</div>'
            f'</div>'
        )

    subject = f"Your Ticket for {allocation.artist.name} — {allocation.event.title}"
    html_content = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#121212;color:#ffffff;border-radius:16px;">
        <h2 style="margin-top:0;color:#ff2a85;">You're going to see {allocation.artist.name}!</h2>
        <p style="font-size:15px;line-height:1.5;color:#e0e0e0;">
            Your ticket confirmation for <strong>{allocation.event.title}</strong> is ready below.
        </p>
        <div style="background:#1a1a1a;padding:14px 16px;border-radius:10px;margin:16px 0;font-size:14px;line-height:1.6;">
            <div><strong>Artist:</strong> {allocation.artist.name}</div>
            <div><strong>Event:</strong> {allocation.event.title}</div>
            <div><strong>Venue:</strong> {allocation.event.venue_name}</div>
            <div><strong>Date &amp; Time:</strong> {event_date_str}</div>
            <div><strong>Access Tier:</strong> {allocation.event.custom_message or 'General Admission'}</div>
        </div>
        <p style="font-size:14px;color:#ccc;">
            Tap <strong>Add to Google Wallet</strong> below on your phone to save your pass, or present the QR code at the venue door:
        </p>
        {"".join(ticket_items_html)}
        <p style="font-size:13px;color:#bbb;text-align:center;margin-top:20px;">
            Open Mobile App: <a href="{public_base}" style="color:#80d8ff;font-weight:600;">{public_base}</a><br/>
            Mobile Door Scanner: <a href="{public_base}/scanner" style="color:#80d8ff;font-weight:600;">{public_base}/scanner</a>
        </p>
    </div>
    """
    text_content = strip_tags(html_content)

    if not getattr(settings, "EMAIL_HOST_PASSWORD", ""):
        print(f"[Email Preview -> {email}] Subject: {subject} (Set SMTP_APP_PASSWORD to send live SMTP email)")
        return {
            "sent": False,
            "reason": "SMTP_APP_PASSWORD is not configured yet; ticket pass generated on-screen.",
        }

    try:
        sender = getattr(settings, "DEFAULT_FROM_EMAIL", "justin@eridulabs.org")
        msg = EmailMultiAlternatives(subject, text_content, sender, [email])
        msg.attach_alternative(html_content, "text/html")
        msg.send()
        return {"sent": True, "recipient": email}
    except Exception as e:
        print(f"Email sending failed: {e}")
        return {"sent": False, "reason": str(e)}


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
    email_status = _send_ticket_confirmation_email(allocation, tickets, email)

    return Response({
        'allocation': ArtistEventAllocationSerializer(allocation).data,
        'tickets': TicketSerializer(tickets, many=True).data,
        'email_status': email_status,
    })

@api_view(['POST'])
def record_digital_sale(request, allocation_id):
    allocation = get_object_or_404(ArtistEventAllocation, id=allocation_id)
    amount = int(request.data.get('amount', 1))
    email = request.data.get('email')
    
    tickets = []
    for _ in range(amount):
        ticket = Ticket.objects.create(
            allocation=allocation,
            ticket_type='DIGITAL',
            buyer_email=email or None,
        )
        tickets.append(ticket)
        allocation.digital_tickets_sold += 1
        
    allocation.save()
    email_status = _send_ticket_confirmation_email(allocation, tickets, email)
    return Response({
        'allocation': ArtistEventAllocationSerializer(allocation).data,
        'tickets': TicketSerializer(tickets, many=True).data,
        'email_status': email_status,
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

def _find_ticket_by_identifier(raw_identifier):
    if not raw_identifier:
        return None
    cleaned = str(raw_identifier).strip()

    # Extract UUID if a full URL or string containing a UUID was scanned
    uuid_match = re.search(
        r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
        cleaned,
    )
    if uuid_match:
        try:
            ticket_uuid = uuid.UUID(uuid_match.group(0))
            return Ticket.objects.select_related('allocation__artist', 'allocation__event').filter(id=ticket_uuid).first()
        except (ValueError, ValidationError):
            pass

    # Support 6-8 character short code shown on the ticket card (e.g. "9A010813")
    short_prefix = cleaned.lower()
    if 4 <= len(short_prefix) <= 36:
        for t in Ticket.objects.select_related('allocation__artist', 'allocation__event').order_by('-created_at'):
            if str(t.id).lower().startswith(short_prefix):
                return t
    return None


@api_view(['POST'])
def upload_ticket_image(request):
    image_file = request.FILES.get('image')
    if not image_file:
        return Response({'error': 'No image file provided.'}, status=status.HTTP_400_BAD_REQUEST)

    ext = os.path.splitext(image_file.name)[1].lower() or '.jpg'
    if ext not in ('.jpg', '.jpeg', '.png', '.webp', '.gif'):
        return Response({'error': 'Unsupported image format. Use PNG, JPG, WEBP, or GIF.'}, status=status.HTTP_400_BAD_REQUEST)

    filename = f"tickets/{uuid.uuid4().hex[:12]}{ext}"
    saved_path = default_storage.save(filename, image_file)
    image_url = f"{settings.MEDIA_URL}{saved_path}"
    return Response({'image_url': image_url, 'filename': saved_path})


@api_view(['POST'])
def create_event_allocation(request):
    artist_name = (request.data.get('artist_name') or '').strip()
    event_title = (request.data.get('event_title') or '').strip()
    venue_name = (request.data.get('venue_name') or '').strip()
    if not artist_name or not event_title or not venue_name:
        return Response(
            {'error': 'Artist name, event title, and venue name are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    base_slug = slugify(artist_name) or f"artist-{uuid.uuid4().hex[:6]}"
    slug = base_slug
    counter = 1
    while Artist.objects.filter(slug=slug).exists():
        counter += 1
        slug = f"{base_slug}-{counter}"

    artist = Artist.objects.create(name=artist_name, slug=slug)

    raw_date = request.data.get('event_date')
    parsed_date = parse_datetime(raw_date) if raw_date else None
    if not parsed_date:
        parsed_date = timezone.now() + timezone.timedelta(days=7)
    elif timezone.is_naive(parsed_date):
        parsed_date = timezone.make_aware(parsed_date)

    event = Event.objects.create(
        title=event_title,
        venue_name=venue_name,
        date=parsed_date,
        theme_color=request.data.get('theme_color') or '#1a1a1a',
        background_image_url=request.data.get('background_image_url')
        or 'https://images.unsplash.com/photo-1540039155733-d7fbc999e347?auto=format&fit=crop&q=80&w=1000',
        custom_message=request.data.get('custom_message') or 'General Admission',
    )

    ticket_goal = int(request.data.get('ticket_goal') or 50)
    allocation = ArtistEventAllocation.objects.create(
        artist=artist,
        event=event,
        ticket_goal=ticket_goal,
    )
    return Response(ArtistEventAllocationSerializer(allocation).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def list_tickets(request):
    qs = Ticket.objects.select_related('allocation__artist', 'allocation__event').order_by('-created_at')
    allocation_id = request.GET.get('allocation_id')
    if allocation_id:
        qs = qs.filter(allocation_id=allocation_id)
    return Response(TicketSerializer(qs[:100], many=True).data)


@api_view(['POST'])
def scan_ticket(request, ticket_id):
    ticket = _find_ticket_by_identifier(ticket_id)
    if not ticket:
        return Response(
            {'success': False, 'message': f'Ticket "{ticket_id}" not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    if ticket.status == 'SCANNED':
        return Response(
            {
                'success': False,
                'message': f'Ticket {str(ticket.id)[:8].upper()} has ALREADY been checked in!',
                'ticket': TicketSerializer(ticket).data,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    elif ticket.status == 'REVOKED':
        return Response(
            {
                'success': False,
                'message': f'Ticket {str(ticket.id)[:8].upper()} has been REVOKED!',
                'ticket': TicketSerializer(ticket).data,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    ticket.status = 'SCANNED'
    ticket.save()

    # Best-effort sync of COMPLETED status to Google Wallet
    try:
        _build_google_wallet_pass_data(
            allocation=ticket.allocation,
            resolved_ticket_id=str(ticket.id),
            ticket_status=ticket.status,
            buyer_email=ticket.buyer_email,
            check_remote_api=True,
        )
    except Exception:
        pass

    return Response({
        'success': True,
        'message': f'Checked in! {ticket.allocation.artist.name} @ {ticket.allocation.event.venue_name} ({ticket.allocation.event.custom_message or "GA"})',
        'ticket': TicketSerializer(ticket).data,
    })


@api_view(['POST'])
def update_ticket_status(request, ticket_id):
    ticket = _find_ticket_by_identifier(ticket_id)
    if not ticket:
        return Response({'error': 'Ticket not found.'}, status=status.HTTP_404_NOT_FOUND)

    new_status = (request.data.get('status') or 'VALID').upper()
    if new_status not in ('VALID', 'SCANNED', 'REVOKED'):
        return Response({'error': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)

    ticket.status = new_status
    ticket.save()
    return Response({
        'success': True,
        'message': f'Ticket {str(ticket.id)[:8].upper()} marked as {new_status}.',
        'ticket': TicketSerializer(ticket).data,
    })


@api_view(['POST'])
def send_ticket_email(request, ticket_id):
    ticket = _find_ticket_by_identifier(ticket_id)
    if not ticket:
        return Response({'error': 'Ticket not found.'}, status=status.HTTP_404_NOT_FOUND)

    email = (request.data.get('email') or ticket.buyer_email or settings.EMAIL_HOST_USER).strip()
    if email and ticket.buyer_email != email:
        ticket.buyer_email = email
        ticket.save(update_fields=['buyer_email'])

    email_status = _send_ticket_confirmation_email(ticket.allocation, [ticket], email)
    if email_status.get('sent'):
        return Response({
            'success': True,
            'message': f'Confirmation email with Google Wallet pass sent to {email}!',
            'email_status': email_status,
        })
    return Response(
        {
            'success': False,
            'message': f"Failed to send email: {email_status.get('reason')}",
            'email_status': email_status,
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


@api_view(['GET'])
def quick_checkin_from_link(request, ticket_id):
    ticket = _find_ticket_by_identifier(ticket_id)
    if not ticket:
        return HttpResponse(
            "<html><body style='background:#121212;color:#fff;font-family:sans-serif;text-align:center;padding:40px;'>"
            "<h2>❌ Ticket Not Found</h2></body></html>",
            status=404,
        )

    short_code = str(ticket.id)[:8].upper()
    already_scanned = ticket.status == 'SCANNED'
    if not already_scanned and ticket.status == 'VALID':
        ticket.status = 'SCANNED'
        ticket.save(update_fields=['status'])

    public_base = _get_public_base_url(request)
    badge_color = "#ff9100" if already_scanned else "#00c853"
    headline = "⚠️ Already Checked In" if already_scanned else "✅ Ticket Checked In!"
    subtext = (
        f"Ticket #{short_code} was already scanned earlier."
        if already_scanned
        else f"Ticket #{short_code} is now verified and marked as SCANNED at the door."
    )

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Ticket Check-In #{short_code}</title>
    </head>
    <body style="background:#121212;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:24px;text-align:center;">
      <div style="max-width:420px;margin:20px auto;background:#1e1e1e;border:2px solid {badge_color};border-radius:16px;padding:28px;">
        <h1 style="color:{badge_color};margin-top:0;">{headline}</h1>
        <p style="font-size:16px;color:#ddd;">{subtext}</p>
        <hr style="border:none;border-top:1px solid #333;margin:18px 0;" />
        <div style="text-align:left;font-size:15px;line-height:1.7;">
          <div><strong>Ticket Code:</strong> #{short_code}</div>
          <div><strong>Artist:</strong> {ticket.allocation.artist.name}</div>
          <div><strong>Event:</strong> {ticket.allocation.event.title}</div>
          <div><strong>Venue:</strong> {ticket.allocation.event.venue_name}</div>
          <div><strong>Tier:</strong> {ticket.allocation.event.custom_message or 'General Admission'}</div>
          <div><strong>Status:</strong> <span style="color:#00e676;font-weight:700;">{ticket.status}</span></div>
        </div>
        <div style="margin-top:24px;">
          <a href="{public_base}/scanner" style="display:inline-block;background:#4285F4;color:#fff;padding:12px 22px;border-radius:20px;text-decoration:none;font-weight:600;">
            Open Full Venue Scanner
          </a>
        </div>
      </div>
    </body>
    </html>
    """
    return HttpResponse(html)

def _normalize_hex_color(color_str):
    if not color_str or not isinstance(color_str, str):
        return "#1a1a1a"
    color_str = color_str.strip()
    if re.fullmatch(r"#[0-9a-fA-F]{6}", color_str):
        return color_str.lower()
    if re.fullmatch(r"#[0-9a-fA-F]{3}", color_str):
        r, g, b = color_str[1], color_str[2], color_str[3]
        return f"#{r}{r}{g}{g}{b}{b}".lower()
    return "#1a1a1a"


def _get_lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def _check_or_sync_google_wallet_api(service_account_info, event_ticket_class, event_ticket_object):
    try:
        now = int(time.time())
        assertion = jwt.encode(
            {
                "iss": service_account_info["client_email"],
                "scope": "https://www.googleapis.com/auth/wallet_object.issuer",
                "aud": service_account_info.get("token_uri", "https://oauth2.googleapis.com/token"),
                "iat": now,
                "exp": now + 3600,
            },
            service_account_info["private_key"],
            algorithm="RS256",
            headers={"kid": service_account_info.get("private_key_id")},
        )
        token_body = urllib.parse.urlencode({
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": assertion,
        }).encode("utf-8")
        token_req = urllib.request.Request(
            service_account_info.get("token_uri", "https://oauth2.googleapis.com/token"),
            data=token_body,
        )
        with urllib.request.urlopen(token_req, timeout=4) as token_resp:
            access_token = json.loads(token_resp.read().decode("utf-8"))["access_token"]

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

        class_url = "https://walletobjects.googleapis.com/walletobjects/v1/eventTicketClass"
        req = urllib.request.Request(
            class_url,
            data=json.dumps(event_ticket_class).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            urllib.request.urlopen(req, timeout=4).close()
        except urllib.error.HTTPError as e:
            if e.code == 409:
                # Class already exists, update it
                put_url = f"{class_url}/{urllib.parse.quote(event_ticket_class['id'], safe='')}"
                put_req = urllib.request.Request(
                    put_url,
                    data=json.dumps(event_ticket_class).encode("utf-8"),
                    headers=headers,
                    method="PUT",
                )
                urllib.request.urlopen(put_req, timeout=4).close()
            elif e.code == 403:
                return (
                    "permission_denied",
                    f"Service account {service_account_info['client_email']} needs to be invited under Users in Google Pay & Wallet Console for Issuer ID {settings.GOOGLE_WALLET_ISSUER_ID}.",
                )
            else:
                return ("warning", f"Google Wallet API returned HTTP {e.code}")

        obj_url = "https://walletobjects.googleapis.com/walletobjects/v1/eventTicketObject"
        obj_req = urllib.request.Request(
            obj_url,
            data=json.dumps(event_ticket_object).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            urllib.request.urlopen(obj_req, timeout=4).close()
        except urllib.error.HTTPError as e:
            if e.code == 409:
                put_obj_url = f"{obj_url}/{urllib.parse.quote(event_ticket_object['id'], safe='')}"
                put_obj_req = urllib.request.Request(
                    put_obj_url,
                    data=json.dumps(event_ticket_object).encode("utf-8"),
                    headers=headers,
                    method="PUT",
                )
                urllib.request.urlopen(put_obj_req, timeout=4).close()

        return ("synced", "EventTicketClass and EventTicketObject synced with Google Wallet API.")
    except Exception as exc:
        return ("offline", str(exc))


def _resolve_ticket_and_allocation(request, ticket_id):
    ticket = None
    try:
        ticket_uuid = uuid.UUID(str(ticket_id))
        ticket = Ticket.objects.select_related('allocation__artist', 'allocation__event').filter(id=ticket_uuid).first()
    except (ValueError, ValidationError):
        ticket = None

    if ticket is not None:
        return ticket.allocation, str(ticket.id), ticket.status, ticket.buyer_email

    allocation_id = request.GET.get('allocation_id')
    if allocation_id:
        allocation = get_object_or_404(
            ArtistEventAllocation.objects.select_related('artist', 'event'),
            id=allocation_id,
        )
    else:
        allocation = ArtistEventAllocation.objects.select_related('artist', 'event').first()
        if not allocation:
            return None, None, None, None

    resolved_ticket_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"preview-{allocation.id}-{ticket_id}"))
    return allocation, resolved_ticket_id, 'VALID', None


def _build_google_wallet_pass_data(
    allocation,
    resolved_ticket_id,
    ticket_status='VALID',
    buyer_email=None,
    request_origin=None,
    check_remote_api=True,
):
    issuer_id = settings.GOOGLE_WALLET_ISSUER_ID
    class_id = f"{issuer_id}.event_allocation_{allocation.id}"
    object_id = f"{issuer_id}.ticket_{resolved_ticket_id}"
    hex_color = _normalize_hex_color(allocation.event.theme_color)
    custom_message = allocation.event.custom_message or "General Admission"
    short_ticket_id = resolved_ticket_id[:8].upper()

    event_ticket_class = {
        "id": class_id,
        "issuerName": settings.GOOGLE_WALLET_ISSUER_NAME,
        "reviewStatus": "UNDER_REVIEW",
        "eventId": str(allocation.event.id),
        "eventName": {
            "defaultValue": {
                "language": "en-US",
                "value": f"{allocation.artist.name} - {allocation.event.title}",
            }
        },
        "venue": {
            "name": {
                "defaultValue": {
                    "language": "en-US",
                    "value": allocation.event.venue_name,
                }
            },
            "address": {
                "defaultValue": {
                    "language": "en-US",
                    "value": allocation.event.venue_name,
                }
            },
        },
        "hexBackgroundColor": hex_color,
    }

    if allocation.event.date:
        event_ticket_class["dateTime"] = {
            "start": allocation.event.date.isoformat(),
        }

    bg_url = allocation.event.background_image_url or ""
    is_local_bg = any(
        host_hint in bg_url
        for host_hint in ("localhost", "127.0.0.1", "192.168.", "10.", "172.")
    )
    wallet_hero_uri = (
        bg_url
        if (bg_url.startswith("https://") and not is_local_bg)
        else "https://images.unsplash.com/photo-1540039155733-d7fbc999e347?auto=format&fit=crop&q=80&w=1000"
    )
    event_ticket_class["heroImage"] = {
        "sourceUri": {
            "uri": wallet_hero_uri,
        },
        "contentDescription": {
            "defaultValue": {
                "language": "en-US",
                "value": allocation.event.title,
            }
        },
    }

    state_map = {
        "VALID": "ACTIVE",
        "SCANNED": "COMPLETED",
        "REVOKED": "EXPIRED",
    }

    event_ticket_object = {
        "id": object_id,
        "classId": class_id,
        "state": state_map.get(ticket_status, "ACTIVE"),
        "ticketHolderName": buyer_email or "General Admission Guest",
        "ticketNumber": short_ticket_id,
        "ticketType": {
            "defaultValue": {
                "language": "en-US",
                "value": custom_message,
            }
        },
        "barcode": {
            "type": "QR_CODE",
            "value": resolved_ticket_id,
            "alternateText": short_ticket_id,
        },
    }

    key_file_path = getattr(settings, "GOOGLE_WALLET_SERVICE_ACCOUNT_FILE", None)
    if not key_file_path or not os.path.exists(key_file_path):
        raise FileNotFoundError(f"Google Wallet service account key file not found at {key_file_path}.")

    with open(key_file_path, "r", encoding="utf-8") as f:
        service_account_info = json.load(f)

    private_key = service_account_info.get("private_key")
    client_email = service_account_info.get("client_email", settings.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL)
    private_key_id = service_account_info.get("private_key_id", settings.GOOGLE_WALLET_KEY_ID)

    wallet_api_status = "embedded"
    wallet_api_message = ""
    if check_remote_api:
        wallet_api_status, wallet_api_message = _check_or_sync_google_wallet_api(
            service_account_info,
            event_ticket_class,
            event_ticket_object,
        )

    public_base = _get_public_base_url()
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        settings.GOOGLE_WALLET_WEBSITE_URL,
    ]
    if public_base and public_base not in origins:
        origins.append(public_base)
    if request_origin and request_origin not in origins:
        origins.append(request_origin)

    # If already synced to Google Wallet API, we can use a compact reference payload (much shorter QR code!)
    if wallet_api_status == "synced":
        payload = {
            "eventTicketObjects": [{"id": object_id, "classId": class_id}],
        }
    else:
        payload = {
            "eventTicketClasses": [event_ticket_class],
            "eventTicketObjects": [event_ticket_object],
        }

    claims = {
        "iss": client_email,
        "aud": "google",
        "typ": "savetowallet",
        "iat": int(time.time()),
        "origins": origins,
        "payload": payload,
    }

    signed_jwt = jwt.encode(
        claims,
        private_key,
        algorithm="RS256",
        headers={"kid": private_key_id},
    )

    save_url = f"https://pay.google.com/gp/v/save/{signed_jwt}"
    lan_ip = _get_lan_ip()
    public_base = _get_public_base_url()
    qr_redirect_url = f"{public_base}/api/tickets/{resolved_ticket_id}/google-wallet/redirect/?allocation_id={allocation.id}"

    return {
        "save_url": save_url,
        "qr_url": qr_redirect_url,
        "lan_ip": lan_ip,
        "jwt": signed_jwt,
        "issuer_id": issuer_id,
        "class_id": class_id,
        "object_id": object_id,
        "wallet_api_status": wallet_api_status,
        "wallet_api_message": wallet_api_message,
    }


@api_view(['GET'])
def generate_google_wallet_jwt(request, ticket_id):
    allocation, resolved_ticket_id, ticket_status, buyer_email = _resolve_ticket_and_allocation(request, ticket_id)
    if not allocation:
        return Response(
            {'error': 'Ticket not found and no allocation available for preview.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        pass_data = _build_google_wallet_pass_data(
            allocation=allocation,
            resolved_ticket_id=resolved_ticket_id,
            ticket_status=ticket_status,
            buyer_email=buyer_email,
            request_origin=request.META.get("HTTP_ORIGIN"),
            check_remote_api=True,
        )
        return Response(pass_data)
    except FileNotFoundError as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def redirect_google_wallet_pass(request, ticket_id):
    allocation, resolved_ticket_id, ticket_status, buyer_email = _resolve_ticket_and_allocation(request, ticket_id)
    if not allocation:
        return Response(
            {'error': 'Ticket not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )
    pass_data = _build_google_wallet_pass_data(
        allocation=allocation,
        resolved_ticket_id=resolved_ticket_id,
        ticket_status=ticket_status,
        buyer_email=buyer_email,
        request_origin=request.META.get("HTTP_ORIGIN"),
        check_remote_api=False,
    )
    return HttpResponseRedirect(pass_data["save_url"])
