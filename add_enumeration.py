import json
from collections import OrderedDict

# Read the JSON file
with open('saa-c03-questions.json', 'r') as f:
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
with open('saa-c03-questions.json', 'w') as f:
    json.dump(enumerated_questions, f, indent=2)
