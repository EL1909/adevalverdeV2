from django.conf import settings
from django.db import transaction
from django.utils.dateparse import parse_date
from evz_calendars.availability import parse_duration
from evz_calendars.models import Appointment
from evz_store.serializers import ProductSerializer
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from evz_payments import paypal
from evz_payments import services as payments
from evz_payments.views import paypal_unavailable
from evz_store.services import receipt_token

from . import services


class ServiceListView(APIView):
    """GET /api/bookings/services/ — asesorías reservables."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        products = services.service_products()
        data = ProductSerializer(products, many=True, context={'request': request}).data
        for row, product in zip(data, products):
            row['minutes'] = parse_duration(product.duration) or 60
            row['currency'] = payments.currency()
        return Response(data)


def service_or_404(request):
    product = services.get_service(request.query_params.get('service') or request.data.get('service'))
    if not product:
        return None, Response({'error': 'Asesoría no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
    return product, None


class DaysView(APIView):
    """GET /api/bookings/days/?service=ID — días con atención en el plazo de reserva."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        product, error = service_or_404(request)
        if error:
            return error
        return Response({'timezone': settings.TIME_ZONE, 'days': services.open_days(product)})


class SlotsView(APIView):
    """GET /api/bookings/slots/?service=ID&date=YYYY-MM-DD — horarios libres (hora de Madrid)."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        product, error = service_or_404(request)
        if error:
            return error
        date = parse_date(request.query_params.get('date') or '')
        if not date:
            return Response({'error': 'Fecha inválida.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(services.day_slots(product, date))


class BookingCreateView(APIView):
    """
    POST /api/bookings/ {service, start, customer_name, customer_email, customer_phone, message, method}
    method: 'paypal' (por defecto) o el ID de un método de pago manual.
    → {receipt, ...} como /api/payments/checkout/: {status: 'completed'} si es
    gratuita, {paypal_order_id} o {manual: {...}}.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        product, error = service_or_404(request)
        if error:
            return error
        start = services.parse_start(request.data.get('start'))
        if not start:
            return Response({'error': 'Elige un horario.'}, status=status.HTTP_400_BAD_REQUEST)
        user = request.user if request.user.is_authenticated else None
        try:
            appt = services.create_booking(
                product=product, start=start, user=user,
                customer_name=request.data.get('customer_name', ''),
                customer_email=request.data.get('customer_email', ''),
                customer_phone=request.data.get('customer_phone', ''),
                message=request.data.get('message', ''),
            )
        except payments.CheckoutError as e:
            return Response({'error': str(e)}, status=status.HTTP_409_CONFLICT)

        order = appt.order
        try:
            with transaction.atomic():
                result = payments.begin_payment(order, request.data.get('method'))
        except (payments.CheckoutError, paypal.PayPalError) as e:
            services.cancel_booking(appt, 'Cancelada: no se pudo iniciar el pago.')
            order.status = 'cancelled'
            order.save(update_fields=['status'])
            if isinstance(e, paypal.PayPalError):
                return paypal_unavailable(e)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'receipt': receipt_token(order), **result}, status=status.HTTP_201_CREATED)


class MyBookingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        appts = (Appointment.objects.filter(order__user=request.user)
                 .exclude(status='cancelled', order__status='cancelled')
                 .select_related('order').prefetch_related('items').order_by('-start_time'))
        return Response([services.booking_payload(a) for a in appts])


class BookingCancelView(APIView):
    """POST /api/bookings/<id>/cancel/ — solo sesiones gratuitas, con antelación."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        appt = Appointment.objects.filter(pk=pk, order__user=request.user).select_related('order').first()
        if not appt:
            return Response({'error': 'Asesoría no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        if not services.can_customer_cancel(appt):
            return Response({'error': 'Esta asesoría no se puede cancelar desde la web. Escríbenos y lo vemos.'},
                            status=status.HTTP_400_BAD_REQUEST)
        services.cancel_booking(appt, f'Cancelada por {request.user.email} desde su cuenta.')
        return Response(services.booking_payload(appt))
