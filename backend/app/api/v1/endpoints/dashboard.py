from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.dashboard_service import DashboardService


router = APIRouter()


@router.get("/")
def get_dashboard(db: Session = Depends(get_db)):
    return DashboardService.get_summary(db)
