#!/usr/bin/env python3
"""Generate Instagram captions for CMPLX Detailing clips using the Claude API."""

import argparse
import os
import sqlite3

import anthropic

DB_PATH = os.environ.get("CLIPS_DB_PATH", "clips.db")
MODEL = "claude-sonnet-4-6"

PROMPT_TEMPLATE = """You are writing Instagram captions for CMPLX Detailing, a mobile auto detailing
business in Buford/Atlanta/Gwinnett County, GA.

BRAND VOICE:
- Direct, no-nonsense, zero corporate fluff
- Confident, not salesy — the work speaks for itself
- Short lines, punchy — avoid exclamation-point-everything
- No cutesy puns, no "wax on wax off" energy
- Dark/raw aesthetic influence (streetwear, underground music culture) —
  understated confidence, not loud bragging
- Never oversell — state facts, let the transformation do the talking

CAPTION STRUCTURE:
1. Hook line (first line, has to stop the scroll — question, bold statement,
   or contrarian take)
2. 1-3 short lines of substance (the story, the value point, or the process detail)
3. Soft CTA (booking link in bio, or a direct "DM to book" — not desperate, not pushy)
4. 3-5 relevant hashtags (mix of local: #BufordGA #GwinnettCounty + niche:
   #MobileDetailing #CeramicCoating)

INPUT PER CLIP:
- Category: {category}
- Service type: {service_type}
- Content idea/format (if matched): {content_idea}

Write ONE caption only. No preamble, no options — just the caption."""


def ensure_columns(conn):
    existing = {row[1] for row in conn.execute("PRAGMA table_info(clips)")}
    for column in ("service_type", "content_idea", "caption"):
        if column not in existing:
            conn.execute(f"ALTER TABLE clips ADD COLUMN {column} TEXT")
    conn.commit()


def build_prompt(row):
    return PROMPT_TEMPLATE.format(
        category=row["category"],
        service_type=row["service_type"] or "unspecified",
        content_idea=row["content_idea"] or "none",
    )


def generate_caption(client, row):
    message = client.messages.create(
        model=MODEL,
        max_tokens=300,
        messages=[{"role": "user", "content": build_prompt(row)}],
    )
    return message.content[0].text.strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--limit",
        type=int,
        default=10,
        help="Number of clips to process (default: 10, for spot-checking before scaling up)",
    )
    args = parser.parse_args()

    client = anthropic.Anthropic()

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    ensure_columns(conn)

    rows = conn.execute(
        "SELECT * FROM clips WHERE caption IS NULL AND category IS NOT NULL LIMIT ?",
        (args.limit,),
    ).fetchall()

    for row in rows:
        caption = generate_caption(client, row)
        conn.execute(
            "UPDATE clips SET caption = ? WHERE clip_id = ?",
            (caption, row["clip_id"]),
        )
        conn.commit()
        print(f"--- clip_id {row['clip_id']} ---")
        print(caption)
        print()


if __name__ == "__main__":
    main()
