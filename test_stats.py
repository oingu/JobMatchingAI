from app.database import SessionLocal
from app.services.evaluation import compare_baseline_vs_improved, precision_recall_at_k

db = SessionLocal()
print("Quality:", precision_recall_at_k(db, k=5))
print("Comparison Delta:", compare_baseline_vs_improved(db, k=5)["delta"])
