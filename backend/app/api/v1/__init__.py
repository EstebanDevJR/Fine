from fastapi import APIRouter

from app.api.v1 import audit, health, upload, report, metrics, ready, account

router = APIRouter()
router.include_router(health.router)
router.include_router(upload.router)
router.include_router(audit.router)
router.include_router(report.router)
router.include_router(metrics.router)
router.include_router(ready.router)
router.include_router(account.router)

__all__ = ["router"]

