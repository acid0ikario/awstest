import json
from pathlib import Path

src = Path("saa-c03-questions.json")
out = Path("saa-c03-questions-cleaned.json")

def normalize_question(q):
    # Normalize by stripping whitespace and lowering case
    return q.strip().replace("\u00a0", " ").replace("\n", " ").replace("\r", " ").replace("  ", " ").lower()

with src.open(encoding="utf-8") as f:
    data = json.load(f)

seen = set()
unique = []
skipped = 0
for q in data:
    question = q.get("question", "")
    norm = normalize_question(question) if question else ""
    if norm:
        if norm not in seen:
            seen.add(norm)
            unique.append(q)
    else:
        skipped += 1

with out.open("w", encoding="utf-8") as f:
    json.dump(unique, f, indent=2, ensure_ascii=False)

print(f"Original: {len(data)} questions\nUnique: {len(unique)} questions\nSkipped: {skipped} (missing/empty question)\nSaved to {out}")
