from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AllocationViewSet,
    record_cash_sale,
    record_digital_sale,
    get_allocation_by_slug,
    scan_ticket,
    update_ticket_status,
    send_ticket_email,
    quick_checkin_from_link,
    list_tickets,
    upload_ticket_image,
    create_event_allocation,
    event_detail,
    artist_detail,
    generate_google_wallet_jwt,
    redirect_google_wallet_pass,
)

router = DefaultRouter()
router.register(r'allocations', AllocationViewSet)

urlpatterns = [
    path('allocations/create-event/', create_event_allocation),
    path('', include(router.urls)),
    path('upload-image/', upload_ticket_image),
    path('tickets/', list_tickets),
    path('allocations/<int:allocation_id>/cash-sale/', record_cash_sale),
    path('allocations/<int:allocation_id>/digital-sale/', record_digital_sale),
    path('events/<int:event_id>/', event_detail),
    path('artists/<int:artist_id>/', artist_detail),
    path('landing/<slug:slug>/', get_allocation_by_slug),
    path('tickets/<str:ticket_id>/scan/', scan_ticket),
    path('tickets/<str:ticket_id>/check-in/', quick_checkin_from_link),
    path('tickets/<str:ticket_id>/send-email/', send_ticket_email),
    path('tickets/<str:ticket_id>/status/', update_ticket_status),
    path('tickets/<str:ticket_id>/google-wallet/', generate_google_wallet_jwt),
    path('tickets/<str:ticket_id>/google-wallet/redirect/', redirect_google_wallet_pass),
]
