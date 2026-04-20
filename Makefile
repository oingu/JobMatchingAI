.PHONY: install run test migrate seed demo benchmark docker-up docker-down

install:
	python3 -m venv .venv
	. .venv/bin/activate && pip install -r requirements.txt

run:
	. .venv/bin/activate && uvicorn app.main:app --reload

test:
	. .venv/bin/activate && pytest -q

migrate:
	. .venv/bin/activate && alembic upgrade head

seed:
	. .venv/bin/activate && python scripts/generate_dataset.py

demo:
	. .venv/bin/activate && python scripts/demo_scenario.py

benchmark:
	. .venv/bin/activate && python scripts/benchmark.py

docker-up:
	docker compose up --build

docker-down:
	docker compose down
