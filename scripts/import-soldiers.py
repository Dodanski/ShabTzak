#!/usr/bin/env python3
"""
Import soldiers from soldier_list.xlsx into Google Sheets.

Usage:
    python3 scripts/import-soldiers.py \
        --token YOUR_OAUTH_ACCESS_TOKEN \
        --spreadsheet-id 1t9g1Fu3IuLzEAC1n-R4x6KEP-fQVAkXV6xwbIQ0kyCM \
        --xlsx soldier_list.xlsx

How to get your OAuth access token:
    1. Open the ShabTzak app in your browser
    2. Open DevTools (F12) → Network tab
    3. Look for any request to sheets.googleapis.com
    4. Copy the Authorization header value (without "Bearer ")
    5. Pass it to --token

The script writes one tab per company (e.g., "א'", "ב'", etc.) using the
English header format expected by the app:
    ID | Name | Role | ServiceStart | ServiceEnd | InitialFairness |
    CurrentFairness | Status | HoursWorked | WeekendLeavesCount |
    MidweekLeavesCount | AfterLeavesCount
"""

import argparse
import json
import urllib.request
import urllib.error
import sys
import warnings

try:
    import openpyxl
except ImportError:
    print("ERROR: openpyxl not installed. Run: pip3 install openpyxl")
    sys.exit(1)

# Map Hebrew status values to app Status enum
STATUS_MAP = {
    'ביחידה': 'Active',
    'יוצא הביתה': 'Active',
    'נפקד': 'Active',
    'בתפקיד מחוץ ליחידה': 'Active',
    'בדרך ליחידה': 'Active',
    'טרם התייצב': 'Active',
    'משתחרר היום': 'Discharged',
    'שוחרר': 'Discharged',
}

HEADER_ROW = [
    'ID', 'Name', 'Role', 'ServiceStart', 'ServiceEnd',
    'InitialFairness', 'CurrentFairness', 'Status',
    'HoursWorked', 'WeekendLeavesCount', 'MidweekLeavesCount', 'AfterLeavesCount',
]


def read_soldiers(xlsx_path: str):
    """Read xlsx and return {company_name: [row, ...]} with English headers."""
    warnings.filterwarnings('ignore')
    wb = openpyxl.load_workbook(xlsx_path)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        print("ERROR: xlsx file is empty")
        sys.exit(1)

    companies = {}

    for row in rows[1:]:
        if not row[0]:  # skip empty rows
            continue

        personal_id = str(int(row[0]))           # מספר אישי
        last_name = str(row[1] or '').strip()     # שם משפחה
        first_name = str(row[2] or '').strip()    # שם פרטי
        company = str(row[3] or '').strip()       # פלוגה
        role = str(row[7] or '').strip()          # תפקיד

        # Use the last available status column
        status_raw = None
        for col in reversed(row[8:]):
            if col:
                status_raw = str(col).strip()
                break
        app_status = STATUS_MAP.get(status_raw or '', 'Active')

        name = f"{first_name} {last_name}".strip()

        soldier_row = [
            personal_id,  # ID
            name,          # Name
            role,          # Role
            '',            # ServiceStart (not available in xlsx)
            '',            # ServiceEnd (not available in xlsx)
            '0',           # InitialFairness
            '0',           # CurrentFairness
            app_status,    # Status
            '0',           # HoursWorked
            '0',           # WeekendLeavesCount
            '0',           # MidweekLeavesCount
            '0',           # AfterLeavesCount
        ]

        if company not in companies:
            companies[company] = []
        companies[company].append(soldier_row)

    return companies


def sheets_update(spreadsheet_id, range_, values, token):
    """Call Google Sheets API to update a range."""
    url = (
        f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/"
        f"{urllib.parse.quote(range_, safe='')}?valueInputOption=RAW"
    )
    body = json.dumps({"range": range_, "values": values, "majorDimension": "ROWS"}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        method='PUT',
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        print(f"ERROR writing to {range_}: HTTP {e.code}: {body_text}")
        raise


def sheets_clear(spreadsheet_id, range_, token):
    """Clear a range via Google Sheets API."""
    import urllib.parse
    url = (
        f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/"
        f"{urllib.parse.quote(range_, safe='')}:clear"
    )
    req = urllib.request.Request(
        url,
        data=b'{}',
        method='POST',
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        body_text = e.read().decode()
        print(f"ERROR clearing {range_}: HTTP {e.code}: {body_text}")
        raise


def main():
    import urllib.parse  # noqa: needed for sheets_clear

    parser = argparse.ArgumentParser(description='Import soldiers from xlsx to Google Sheets')
    parser.add_argument('--token', required=True, help='OAuth access token')
    parser.add_argument('--spreadsheet-id', required=True, help='Google Spreadsheet ID')
    parser.add_argument('--xlsx', default='soldier_list.xlsx', help='Path to soldier_list.xlsx')
    parser.add_argument('--company', help='Only import a specific company (e.g. "א\'")')
    parser.add_argument('--dry-run', action='store_true', help='Print data without writing to sheets')
    args = parser.parse_args()

    print(f"Reading soldiers from {args.xlsx}...")
    companies = read_soldiers(args.xlsx)

    if args.company:
        if args.company not in companies:
            print(f"ERROR: Company '{args.company}' not found. Available: {list(companies.keys())}")
            sys.exit(1)
        companies = {args.company: companies[args.company]}

    print(f"\nFound {sum(len(v) for v in companies.values())} soldiers in {len(companies)} companies:")
    for comp, soldiers in sorted(companies.items(), key=lambda x: str(x[0])):
        print(f"  {comp}: {len(soldiers)} soldiers")

    if args.dry_run:
        print("\n--- DRY RUN: showing first 3 rows per company ---")
        for comp, soldiers in sorted(companies.items(), key=lambda x: str(x[0])):
            print(f"\n{comp}:")
            print("  " + " | ".join(HEADER_ROW))
            for row in soldiers[:3]:
                print("  " + " | ".join(row))
        return

    print(f"\nWriting to spreadsheet {args.spreadsheet_id}...")
    for comp, soldiers in sorted(companies.items(), key=lambda x: str(x[0])):
        tab = comp  # tab name = company name
        values = [HEADER_ROW] + soldiers
        range_ = f"{tab}!A1"
        print(f"  Writing {len(soldiers)} soldiers to tab '{tab}'...", end=' ')
        try:
            sheets_clear(args.spreadsheet_id, f"{tab}!A:L", args.token)
            sheets_update(args.spreadsheet_id, range_, values, args.token)
            print("OK")
        except Exception as e:
            print(f"FAILED: {e}")

    print("\nDone!")


if __name__ == '__main__':
    main()
