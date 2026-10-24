# ViaCRM Frontend Bridge

Install `ViaCRM-Frontend-Bridge-1.0.0.zip` through EspoCRM Administration → Extensions. The extension adds public bridge endpoints used by the React client:

- `GET /api/v1/LeadCapture/formData/{formId}` returns the same public-safe form data that EspoCRM's native `LeadCaptureForm` entry point prepares.
- `GET /api/v1/LeadCapture/confirmOptIn/{uniqueId}` completes the native one-click opt-in confirmation and returns its status/message.
- `GET /api/v1/Campaign/unsubscribeInfo/{queueItemId}` or `.../{emailAddress}/{hash}` reads subscription status for the native unsubscribe page.
- `GET /api/v1/Campaign/trackOpened/{queueItemId}` records a campaign open and returns a transparent PNG tracking pixel.
- `GET /api/v1/EventConfirmation/{uniqueId}/{action}` applies an attendee response through the native relation, hook and activity-note behavior.
- `GET /api/v1/User/passwordRecoveryInfo` reports the server's password-recovery availability and configured strength rules.
- `GET /api/v1/User/passwordChangeInfo/{requestId}` checks whether a one-time password-change request remains valid and returns the configured strength rules.

The password bridge returns no user identity or password-request data; password request and password change still use EspoCRM's own no-auth actions. The form submit itself remains EspoCRM's built-in `POST /api/v1/LeadCapture/form/{formId}` action.

In the workspace Docker Compose stack, Nginx serves the React frontend at the configured CRM origin (`http://localhost:8091`) and proxies `/api/*` and `/client/*` to EspoCRM; direct backend administration remains available at `http://localhost:8092`. For production, route the public frontend and `/api/v1/*` through the same HTTPS site origin so generated confirmation, unsubscribe and public form URLs reach the replacement frontend. This PHP extension supplies public workflow endpoints only; the Docker image supplies the React assets and gateway, and the extension ZIP alone does not replace the EspoCRM client.
