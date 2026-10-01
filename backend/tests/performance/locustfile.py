"""Prueba de carga de la API (RNF-01/RNF-02) con Locust.

Requisitos: backend levantado (uvicorn app.main:app) y el fixture sintético generado.

    cd backend
    locust -f tests/performance/locustfile.py --host http://localhost:8000 \
           --users 20 --spawn-rate 5 --run-time 2m --headless --csv reports/locust

Escenario: cada usuario sube el reporte sintético por fragmentos, espera la extracción,
navega páginas, pide vistas previas y lanza un trabajo de exportación.
"""

from __future__ import annotations

import json
import math
import time
from pathlib import Path

from locust import HttpUser, between, task

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"
PDF = (FIXTURES / "sample_report.pdf").read_bytes()
TEMPLATE = json.loads((FIXTURES / "ventas_template.json").read_text(encoding="utf-8"))
API = "/api/v1"


class MapperUser(HttpUser):
    wait_time = between(0.5, 2)

    def on_start(self) -> None:
        up = self.client.post(f"{API}/uploads", json={"filename": "carga.pdf", "size": len(PDF)}).json()
        size = up["chunk_size"]
        for i in range(math.ceil(len(PDF) / size)):
            self.client.put(
                f"{API}/uploads/{up['upload_id']}/chunks/{i}",
                data=PDF[i * size : (i + 1) * size],
                name=f"{API}/uploads/[id]/chunks/[i]",
            )
        self.file_id = self.client.post(
            f"{API}/uploads/{up['upload_id']}/complete", name=f"{API}/uploads/[id]/complete"
        ).json()["id"]
        for _ in range(100):
            if self.client.get(f"{API}/files/{self.file_id}", name=f"{API}/files/[id]").json()["status"] == "ready":
                break
            time.sleep(0.2)

    @task(5)
    def browse_page(self) -> None:
        self.client.get(f"{API}/files/{self.file_id}/pages/1", name=f"{API}/files/[id]/pages/[n]")

    @task(5)
    def annotate(self) -> None:
        self.client.post(f"{API}/mapping/annotate", json={"file_id": self.file_id, "template": TEMPLATE, "page": 1})

    @task(3)
    def preview(self) -> None:
        self.client.post(f"{API}/mapping/preview", json={"file_id": self.file_id, "template": TEMPLATE})

    @task(1)
    def export(self) -> None:
        self.client.post(f"{API}/jobs", json={"file_id": self.file_id, "template": TEMPLATE, "formats": ["xlsx"]})
