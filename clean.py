import re

with open(r'js\data\daily_plan.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Strip literal line numbers like "50:   }," at the start of a line
content = re.sub(r'(?m)^\d+:\s+', '', content)

# Replace common corrupted dash patterns with a simple hyphen
content = content.replace('?"', '-')
content = content.replace('A,?o', '-')

with open(r'js\data\daily_plan.js', 'w', encoding='utf-8') as f:
    f.write(content)
