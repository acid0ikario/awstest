#!/usr/bin/env python3
"""
Scrape every SAA-C03 question from free-braindumps.com.

Outputs:
    saa-c03-questions.json   –  list[dict] with keys:
        question (str)
        options (dict[str,str])
        correct (list[str])
"""

import json
import re
import time
from pathlib import Path

import requests  # pip install requests
from bs4 import BeautifulSoup  # pip install beautifulsoup4

BASE = "https://free-braindumps.com/amazon/free-saa-c03-braindumps/page-{}"
HEADERS = {
    # Setting a UA avoids the rare 403 errors seen in earlier runs
    "User-Agent": "Mozilla/5.0 (compatible; SAA-C03-scraper/1.0)"
}

NUMBER2LETTER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
results = []
consecutive_empty = 0

for page in range(2, 257):            # the site shows “Viewing Page 256 of 256”
    url = BASE.format(page)
    print(f"▶  Page {page}", end=" … ", flush=True)
    resp = requests.get(url, headers=HEADERS, timeout=30)  # requests quick-start cite
    if resp.status_code != 200:
        print(f"HTTP {resp.status_code}; skipping")
        break

    soup = BeautifulSoup(resp.text, "html.parser")
    lines = soup.get_text("\n").splitlines()

    i = 0
    found = 0
    while i < len(lines):
        if re.match(r"^QUESTION:\s*\d+", lines[i]):
            i += 1
            # collect question stem
            stem_lines = []
            while i < len(lines) and not re.match(r"^\s*\d+\.\s", lines[i]):
                stem_lines.append(lines[i].strip())
                i += 1
            question = " ".join(stem_lines).strip()

            # collect options
            opts = {}
            opt_idx = 0
            while i < len(lines) and re.match(r"^\s*\d+\.\s", lines[i]):
                num, text = lines[i].split(".", 1)
                letter = NUMBER2LETTER[opt_idx]
                opts[letter] = text.strip()
                opt_idx += 1
                i += 1

            # look for Answer(s):
            while i < len(lines) and lines[i].strip() == "":
                i += 1
            correct = []
            if i < len(lines) and lines[i].startswith("Answer"):
                answers_part = lines[i].split(":", 1)[1]
                correct = re.findall(r"[A-Z]", answers_part)
                i += 1

            results.append(
                {"question": question, "options": opts, "correct": correct}
            )
            found += 1
        else:
            i += 1

    if found:
        consecutive_empty = 0
        print(f"{found} questions")
    else:
        consecutive_empty += 1
        print("no questions found")
        if consecutive_empty >= 3:
            print("✦ Stopping: too many empty/404 pages.")
            break

    time.sleep(1)  # polite crawling

# write to JSON
out_file = Path("saa-c03-questions.json")
with out_file.open("w", encoding="utf-8") as fp:
    json.dump(results, fp, indent=2, ensure_ascii=False)  # json.dump cite

print(f"\nSaved {len(results)} questions ➜ {out_file.resolve()}")
