# ViaCRM Frontend Bridge

Install `ViaCRM-Frontend-Bridge-1.4.0.zip` through EspoCRM Administration → Extensions. The extension adds public workflow endpoints and authenticated account-session endpoints used by the React client:

- `GET /api/v1/LeadCapture/formData/{formId}` returns the same public-safe form data that EspoCRM's native `LeadCaptureForm` entry point prepares.
- `GET /api/v1/LeadCapture/confirmOptIn/{uniqueId}` completes the native one-click opt-in confirmation and returns its status/message.
- `GET /api/v1/Campaign/unsubscribeInfo/{queueItemId}` or `.../{emailAddress}/{hash}` reads subscription status for the native unsubscribe page.
- `GET /api/v1/Campaign/trackOpened/{queueItemId}` records a campaign open and returns a transparent PNG tracking pixel.
- `GET /api/v1/EventConfirmation/{uniqueId}/{action}` applies an attendee response through the native relation, hook and activity-note behavior.
- `GET /api/v1/User/passwordRecoveryInfo` reports the server's password-recovery availability and configured strength rules.
- `GET /api/v1/User/passwordChangeInfo/{requestId}` checks whether a one-time password-change request remains valid and returns the configured strength rules.
- `GET /api/v1/UserSecurity/currentSessions` lists up to 50 active sessions owned by the authenticated user, including a current-session marker.
- `DELETE /api/v1/UserSecurity/currentSession/{id}` deactivates a session only when it belongs to the authenticated user.
- `POST /api/v1/UserSecurity/otherSessions` ends every other active session owned by the authenticated user while preserving the current session.
- `GET /api/v1/UserSecurity/currentLoginHistory` returns up to 25 login events associated with the authenticated user, including denied attempts, when EspoCRM records the user ID.
- `GET /api/v1/Portal/publicBranding?path=...&host=...` returns only public display settings for the active portal identified by its native `/portal/{id}` URL or configured custom URL.

The password bridge returns no user identity or password-request data; password request and password change still use EspoCRM's own no-auth actions. Session and history endpoints require authentication and constrain their data to the current user. Session revocation checks ownership before mutation, and bulk revocation verifies the current credential belongs to the authenticated user before ending any other session. The unauthenticated portal-branding endpoint returns only the active portal name, application name, company-logo attachment ID, theme, and navbar setting; the native LogoImage entry point serves only company logos associated with Settings or Portal. The form submit itself remains EspoCRM's built-in `POST /api/v1/LeadCapture/form/{formId}` action.

In the workspace Docker Compose stack, Nginx serves the React frontend at the configured CRM origin (`http://localhost:8091`) and proxies `/api/*` and `/client/*` to EspoCRM; direct backend administration remains available at `http://localhost:8092`. For production, route the public frontend and `/api/v1/*` through the same HTTPS site origin so generated confirmation, unsubscribe and public form URLs reach the replacement frontend. This PHP extension supplies public workflow endpoints only; the Docker image supplies the React assets and gateway, and the extension ZIP alone does not replace the EspoCRM client.
