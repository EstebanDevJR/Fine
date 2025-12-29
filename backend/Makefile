PY=uv pip

install:
	$(PY) install --system .

run-api:
	uvicorn app.main:app --reload

run-worker:
	celery -A app.workers.tasks worker --loglevel=info --concurrency=1

test:
	pytest

lint:
	ruff check .

fmt:
	ruff format .

