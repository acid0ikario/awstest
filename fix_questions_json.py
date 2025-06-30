import json
import re

with open('saa-c03-questions.json', 'r') as f:
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

with open('saa-c03-questions.json', 'w') as f:
    json.dump(fixed, f, indent=2)
