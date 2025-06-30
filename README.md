# AWS Test Project

This repository provides tools to scrape AWS exam questions and a simple frontend to practice them.

## Project Structure

- **scripts/** – Python utilities for scraping and processing question data.
- **web/** – Static website that presents the questions.
  - **data/** – JSON files used by the frontend.

## Getting Started

1. Run the scraper to fetch the questions:
   ```bash
   python scripts/scraper.py
   ```
   The output is written to `web/data/saa-c03-questions.json`.

2. Clean or modify the JSON with the helper scripts in `scripts/` if needed.

3. Open `web/index.html` in a browser to use the quiz interface.

## Architecture

The frontend is a single-page application (`web/index.html`) that loads the
question data asynchronously (`web/app.js`). Questions are stored in JSON format
and are fetched relative to the page. User progress is persisted in the browser's
`localStorage`.

Python scripts in `scripts/` operate on the same dataset to scrape new questions
or adjust formatting. Paths are resolved relative to the project root so the
scripts can be run from any location.

