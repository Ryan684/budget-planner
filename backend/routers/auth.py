"""PIN gate endpoints (Phase 5, US1).

A convenience access lock for a self-hosted family app, not authentication: the
rest of the API stays unauthenticated behind the LAN/Tailscale boundary. The
point of verifying server-side is that the configured PIN never ships in the
client bundle (FR-005a).
"""

import hmac

import schemas
from config import settings
from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/api", tags=["auth"])


@router.get("/pin-required", response_model=schemas.PinRequiredResponse)
def pin_required():
    """Tell the frontend whether to show the gate — never the PIN itself."""
    return schemas.PinRequiredResponse(required=bool(settings.app_pin))


@router.post("/verify-pin", response_model=schemas.PinVerifyResponse)
def verify_pin(payload: schemas.PinVerifyRequest):
    """Check an entered PIN. A wrong PIN is ``200 {"ok": false}``, not an error."""
    if not settings.app_pin:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No PIN is configured")
    # Constant-time compare: cheap, stdlib, removes a trivial timing side-channel.
    ok = hmac.compare_digest(payload.pin, settings.app_pin)
    return schemas.PinVerifyResponse(ok=ok)
