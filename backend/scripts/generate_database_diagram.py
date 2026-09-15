"""Generate docs/database-structure.png from SQLAlchemy metadata.

Run from repository root:
    PYTHONPATH=backend python backend/scripts/generate_database_diagram.py

Requires Pillow and Matplotlib only for documentation generation.
"""

from pathlib import Path
import math

from PIL import Image, ImageDraw, ImageFont
from matplotlib import get_data_path

import app.models  # noqa: F401
from app.core.database import Base


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "docs" / "database-structure.png"
WIDTH, HEIGHT = 3650, 2050
CARD_WIDTH, HEADER_HEIGHT, ROW_HEIGHT = 520, 58, 30

# Stack cards by bounded columns, so new schema tables cannot silently disappear.
POSITIONS = {}
_column_bottoms = [130] * 6
for _name, _table in sorted(Base.metadata.tables.items()):
    _column = min(range(6), key=lambda i: _column_bottoms[i])
    POSITIONS[_name] = (60 + _column * 590, _column_bottoms[_column])
    _column_bottoms[_column] += HEADER_HEIGHT + len(_table.columns) * ROW_HEIGHT + 100
HEIGHT = max(_column_bottoms) + 90

GROUPS = {
    "users": {"users"},
    "repository": {
        "test_suites", "test_cases", "test_case_tags", "test_case_tag_assignments",
        "test_steps", "suite_groups", "suite_group_relations", "suite_group_members",
        "test_case_drafts", "test_case_versions", "test_case_reviews", "test_case_review_comments",
        "test_case_events", "test_case_operations", "test_case_version_tags",
        "suite_group_test_case_members",
    },
    "execution": {
        "test_runs",
        "test_run_attempts",
        "test_run_cases",
        "test_run_case_attempts",
        "test_run_step_results",
    },
}
COLORS = {
    "users": "#6366f1",
    "repository": "#0f766e",
    "execution": "#2563eb",
    "support": "#64748b",
}


def load_font(size, bold=False):
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    return ImageFont.truetype(str(Path(get_data_path()) / "fonts" / "ttf" / name), size)


TITLE_FONT = load_font(34, True)
SUBTITLE_FONT = load_font(18)
TABLE_FONT = load_font(21, True)
ROW_FONT = load_font(15)
ROW_BOLD_FONT = load_font(15, True)


def group_for(table_name):
    for group, tables in GROUPS.items():
        if table_name in tables:
            return group
    return "support"


def card_height(table):
    return HEADER_HEIGHT + len(table.columns) * ROW_HEIGHT + 16


def anchor(table_name, side):
    table = Base.metadata.tables[table_name]
    x, y = POSITIONS[table_name]
    height = card_height(table)
    return {
        "left": (x, y + height // 2),
        "right": (x + CARD_WIDTH, y + height // 2),
        "top": (x + CARD_WIDTH // 2, y),
        "bottom": (x + CARD_WIDTH // 2, y + height),
    }[side]


def edge_points(child, parent, lane):
    child_x, child_y = POSITIONS[child]
    parent_x, parent_y = POSITIONS[parent]
    if child == parent:
        start_x, middle_y = anchor(child, "right")
        offset = 45
        return [(start_x, middle_y - 35), (start_x + offset, middle_y - 35),
                (start_x + offset, middle_y + 35), (start_x, middle_y + 35)]
    if child_x != parent_x:
        start = anchor(child, "left" if child_x > parent_x else "right")
        end = anchor(parent, "right" if child_x > parent_x else "left")
        middle_x = (start[0] + end[0]) // 2 + lane * 7
        return [start, (middle_x, start[1]), (middle_x, end[1]), end]
    start = anchor(child, "top" if child_y > parent_y else "bottom")
    end = anchor(parent, "bottom" if child_y > parent_y else "top")
    middle_y = (start[1] + end[1]) // 2 + lane * 7
    return [start, (start[0], middle_y), (end[0], middle_y), end]


def draw_arrow(draw, points, color):
    draw.line(points, fill=color, width=3, joint="curve")
    (x1, y1), (x2, y2) = points[-2], points[-1]
    angle = math.atan2(y2 - y1, x2 - x1)
    for delta in (0.55, -0.55):
        draw.line([(x2, y2), (x2 - 12 * math.cos(angle + delta),
                              y2 - 12 * math.sin(angle + delta))], fill=color, width=3)


def type_label(column):
    value = str(column.type).lower()
    if value.startswith("datetime"):
        return "timestamp"
    return value


def flags_for(column):
    flags = []
    if column.primary_key:
        flags.append("PK")
    if column.foreign_keys:
        flags.append("FK")
    if not column.nullable and not column.primary_key:
        flags.append("NOT NULL")
    if column.unique:
        flags.append("UNIQUE")
    return " · ".join(flags)


def draw_card(draw, table):
    x, y = POSITIONS[table.name]
    height = card_height(table)
    color = COLORS[group_for(table.name)]
    draw.rounded_rectangle((x + 5, y + 7, x + CARD_WIDTH + 5, y + height + 7),
                           radius=16, fill="#cbd5e1")
    draw.rounded_rectangle((x, y, x + CARD_WIDTH, y + height),
                           radius=16, fill="#ffffff", outline="#cbd5e1", width=2)
    draw.rounded_rectangle((x, y, x + CARD_WIDTH, y + HEADER_HEIGHT),
                           radius=16, fill=color)
    draw.rectangle((x, y + HEADER_HEIGHT - 16, x + CARD_WIDTH, y + HEADER_HEIGHT), fill=color)
    draw.text((x + 18, y + 14), table.name, font=TABLE_FONT, fill="#ffffff")

    for index, column in enumerate(table.columns):
        row_y = y + HEADER_HEIGHT + index * ROW_HEIGHT
        if index % 2:
            draw.rectangle((x + 2, row_y, x + CARD_WIDTH - 2, row_y + ROW_HEIGHT), fill="#f8fafc")
        draw.text((x + 16, row_y + 6), column.name,
                  font=ROW_BOLD_FONT if column.primary_key else ROW_FONT, fill="#0f172a")
        draw.text((x + 205, row_y + 6), type_label(column), font=ROW_FONT, fill="#475569")
        flags = flags_for(column)
        if flags:
            box = draw.textbbox((0, 0), flags, font=ROW_FONT)
            draw.text((x + CARD_WIDTH - 16 - (box[2] - box[0]), row_y + 6),
                      flags, font=ROW_FONT, fill="#64748b")


def main():
    missing = set(Base.metadata.tables) - set(POSITIONS)
    if missing:
        raise RuntimeError("Diagram layout is missing tables: " + ", ".join(sorted(missing)))
    image = Image.new("RGB", (WIDTH, HEIGHT), "#f1f5f9")
    draw = ImageDraw.Draw(image)
    draw.text((60, 40), "FET – databázové schéma", font=TITLE_FONT, fill="#0f172a")
    draw.text((60, 86), "Aktuální SQLAlchemy model · PK = primární klíč · FK = cizí klíč",
              font=SUBTITLE_FONT, fill="#64748b")
    tables = [Base.metadata.tables[name] for name in POSITIONS]

    edges = []
    for table in tables:
        for column in table.columns:
            for foreign_key in column.foreign_keys:
                edges.append((table.name, foreign_key.column.table.name))
    for index, (child, parent) in enumerate(edges):
        draw_arrow(draw, edge_points(child, parent, index % 5 - 2),
                   COLORS[group_for(parent)] + "90")
    for table in tables:
        draw_card(draw, table)

    legend = [("Uživatelé", "users"), ("Repository", "repository"),
              ("Exekuce", "execution")]
    x = 60
    for label, group in legend:
        draw.rounded_rectangle((x, HEIGHT - 58, x + 22, HEIGHT - 36),
                               radius=5, fill=COLORS[group])
        draw.text((x + 30, HEIGHT - 58), label, font=ROW_FONT, fill="#334155")
        x += 175

    image.save(OUTPUT, optimize=True)
    print("Generated " + str(OUTPUT) + " (" + str(WIDTH) + "x" + str(HEIGHT) + ")")


if __name__ == "__main__":
    main()
