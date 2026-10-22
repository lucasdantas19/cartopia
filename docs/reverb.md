# Reverb local

Configure the REVERB_* values in backend/.env and the matching
VITE_REVERB_* values in frontend/.env. The application secret belongs only in
the local environment and must not be committed.

Start the processes in separate terminals:

    cd backend && php artisan serve
    cd backend && php artisan reverb:start
    cd frontend && npm run dev

After creating a delivery, use its public_id to send the development event:

    cd backend && php artisan cartopia:broadcast-test <public-id>

The frontend authorizes private-deliveries.{publicId} through
/api/broadcasting/auth with the delivery bearer token. If Reverb variables are
not configured, the tracking page continues to use the REST API and temporal
progress without opening a WebSocket connection.
