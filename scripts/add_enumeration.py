import json
from collections import OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / 'web' / 'data' / 'saa-c03-questions.json'

# Read the JSON file
with DATA_FILE.open('r', encoding='utf-8') as f:
    data = json.load(f)

# Create new list for modified questions
enumerated_questions = []

# Add enumeration field to each question while preserving order
for i, question in enumerate(data, 1):
    # Create new OrderedDict with enumeration as first field
    new_question = OrderedDict()
    new_question['enumeration'] = i
    # Add all existing fields
    new_question.update(question)
    enumerated_questions.append(new_question)

# Write back to file with proper formatting
with DATA_FILE.open('w', encoding='utf-8') as f:
    json.dump(enumerated_questions, f, indent=2, ensure_ascii=False)
