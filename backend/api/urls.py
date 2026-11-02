from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AllocationViewSet, record_cash_sale, record_digital_sale, get_allocation_by_slug, scan_ticket, event_detail, artist_detail, generate_google_wallet_jwt

router = DefaultRouter()
router.register(r'allocations', AllocationViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('allocations/<int:allocation_id>/cash-sale/', record_cash_sale),
    path('allocations/<int:allocation_id>/digital-sale/', record_digital_sale),
    path('events/<int:event_id>/', event_detail),
    path('artists/<int:artist_id>/', artist_detail),
    path('landing/<slug:slug>/', get_allocation_by_slug),
    path('tickets/<uuid:ticket_id>/scan/', scan_ticket),
    path('tickets/<uuid:ticket_id>/google-wallet/', generate_google_wallet_jwt),
]
