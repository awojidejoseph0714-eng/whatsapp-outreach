# Futapreneurs WhatsApp Outreach

A simple, client-side web application for managing WhatsApp outreach campaigns using CSV contact lists.

## Features

- **CSV Upload**: Simply drop your CSV file to load contacts.
- **Progress Tracking**: Keep track of who you've sent messages to.
- **Search & Filter**: Search by name/phone or filter to see only pending contacts.
- **One-Click Send**: Generates WhatsApp links with pre-filled message templates.
- **Local Storage**: Automatically saves your progress locally.

## Getting Started

1. Open `index.html` in your web browser.
2. Upload a CSV file containing `name` and `phone` (optionally `business stage`) columns.
3. Click "Open chat" next to a contact to open WhatsApp with the message ready.

## Expected CSV Format

The CSV must include a header row. The required columns (case-insensitive) are:
- `name`
- `phone`
- `stage` (optional)

## Tech Stack
- Vanilla HTML, CSS, JavaScript (No external dependencies).
