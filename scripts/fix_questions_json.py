import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / 'web' / 'data' / 'saa-c03-questions.json'

with DATA_FILE.open('r', encoding='utf-8') as f:
    data = json.load(f)

fixed = []
for q in data:
    # Only fix if options exist and question is not empty
    if 'options' in q and q.get('question'):
        # Find the last sentence ending with a question mark
        parts = re.split(r'(\?)', q['question'])
        if '?' in parts:
            # Reconstruct up to the last question mark
            idx = ''.join(parts).rfind('?')
            stem = q['question'][:idx+1].strip()
            q['question'] = stem
    fixed.append(q)

with DATA_FILE.open('w', encoding='utf-8') as f:
    json.dump(fixed, f, indent=2, ensure_ascii=False)
