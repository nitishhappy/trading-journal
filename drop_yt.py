import json

with open(r'js\data\daily_plan.js', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to drop the YT-Videos summary object
summary_part = content.split('window.dailyPlanData = [')[0]
data_part = "window.dailyPlanData = [" + content.split('window.dailyPlanData = [')[1]

summary_blocks = summary_part.split('{')
final_summaries = []

for sb in summary_blocks:
    if not sb.strip() or 'window.dailyPlanSummary' in sb:
        continue
    # If it is NOT the YT-Videos block, keep it
    if '"source": "YT-Videos"' not in sb:
        final_summaries.append('{\n' + sb.strip().rstrip(','))

new_summary_section = "window.dailyPlanSummary = [\n" + ",\n".join(final_summaries) + "\n];\n\n"

with open(r'js\data\daily_plan.js', 'w', encoding='utf-8') as f:
    f.write(new_summary_section + data_part)
