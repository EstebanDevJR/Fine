from fastapi import APIRouter

from app.api.v1 import account, audit, health, metrics, ready, report, upload

router = APIRouter()
router.include_router(health.router)
router.include_router(upload.router)
router.include_router(audit.router)
router.include_router(report.router)
router.include_router(metrics.router)
router.include_router(ready.router)
router.include_router(account.router)

__all__ = ["router"]
