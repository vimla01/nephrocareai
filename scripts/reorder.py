import re

with open("/home/vimla/.gemini/antigravity/worktrees/nephrocare/run-project-instance/frontend/src/pages/DashboardPage.tsx", "r") as f:
    content = f.read()

parts = content.split('<div className="dashboard-grid">')
head = parts[0] + '<div className="dashboard-grid">\n'
tail = parts[1]

sections = re.split(r'(\s*\{\/\* \d+\. [^\*]+\*\/\})', tail)
blocks = []
for i in range(1, len(sections), 2):
    blocks.append(sections[i] + sections[i+1])

blocks[10] = blocks[10].replace('<section className="dash-card feature-card">', '<section className="dash-card feature-card col-span-3">')

new_order = [0, 1, 3, 2, 4, 5, 6, 8, 7, 9, 10, 11]
ordered_blocks = [blocks[i] for i in new_order]

new_content = head + sections[0] + "".join(ordered_blocks)

with open("/home/vimla/.gemini/antigravity/worktrees/nephrocare/run-project-instance/frontend/src/pages/DashboardPage.tsx", "w") as f:
    f.write(new_content)
