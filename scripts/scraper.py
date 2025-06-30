#!/usr/bin/env python3
"""
Scrape every SAA-C03 question from free-braindumps.com and save to
saa-c03-questions.json in the format the user requested.
"""

import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / 'web' / 'data' / 'saa-c03-questions.json'

import requests                      # pip install requests
from bs4 import BeautifulSoup        # pip install beautifulsoup4

BASE = "https://free-braindumps.com/amazon/free-saa-c03-braindumps/page-{}"
HEADERS = {                          # avoid intermittent 403s
    "User-Agent": (
        "Mozilla/5.0 (compatible; SAA-C03-scraper/2.0; +https://example.com)"
    )
}

LETTER_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
out = []
empty_pages = 0

for page in range(2, 257):           # site shows “Viewing Page 256 of 256”
    url = BASE.format(page)
    print(f"▶  Page {page}", end=" … ", flush=True)
    r = requests.get(url, headers=HEADERS, timeout=30)      # requests UA example :contentReference[oaicite:2]{index=2}
    if r.status_code != 200:
        print(f"HTTP {r.status_code}; stopping")
        break

    soup = BeautifulSoup(r.text, "html.parser")             # BeautifulSoup docs :contentReference[oaicite:3]{index=3}
    blocks = soup.select("div.panel-body")
    if not blocks:
        empty_pages += 1
        print("no questions")
        if empty_pages >= 3:
            break
        time.sleep(1)
        continue
    empty_pages = 0

    for body in blocks:
        # 1️⃣  question stem
        stem_parts = [" ".join(p.stripped_strings) for p in body.select("p.lead")]
        question = " ".join(stem_parts).strip()

        # 2️⃣  options
        options = {}
        correct = []
        for idx, li in enumerate(body.select("ol.rounded-list li")):
            letter = LETTER_MAP[idx]
            options[letter] = " ".join(li.stripped_strings)
            if li.get("data-correct", "").lower() == "true":
                correct.append(letter)

        # fallback if data-correct missing
        if not correct:
            ans_div = body.select_one("div[id^='answerQ']")
            if ans_div:
                correct = list(ans_div.get_text().upper())
                correct = [c for c in correct if c in LETTER_MAP]

        out.append({"question": question, "options": options, "correct": correct})

    print(f"{len(blocks)} questions")
    time.sleep(1)                    # polite crawling

# write JSON pretty-printed
DATA_FILE.write_text(json.dumps(out, indent=2, ensure_ascii=False))
print(f"\nSaved {len(out)} questions ➜ {DATA_FILE.resolve()}")
  
