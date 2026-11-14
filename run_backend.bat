@echo off
echo ========================================================
echo Starting MediMatch PS10 Backend (FastAPI + WebSocket)
echo Host: http://127.0.0.1:8000
echo Docs: http://127.0.0.1:8000/docs
echo ========================================================
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
