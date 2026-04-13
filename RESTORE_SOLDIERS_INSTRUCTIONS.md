# Instructions: Restore Soldiers Tab in Google Sheets

## Problem
The Soldiers tab in your Google Spreadsheet has corrupted data due to missing Phone column support in the code. Unit names and service dates are showing incorrectly.

## Solution
Use the `update-soldiers-sheet.js` script to restore the correct data from the xlsx file directly to Google Sheets.

## What Will Be Updated
- **Source**: `test_tables/ShabTzak Data.xlsx` (Soldiers sheet)
- **Destination**: Google Spreadsheet ID `1cFnv_vMZHjVPQS1YsNJwKv4on64uKej0LxwaKsGVouk` (Soldiers tab)
- **Data**: 69 rows total (1 header + 68 soldiers)
- **Columns**: ID, First Name, Last Name, Role, Phone, Unit, ServiceStart, ServiceEnd, InitialFairness, CurrentFairness, Status, HoursWorked, WeekendLeavesCount, MidweekLeavesCount, AfterLeavesCount, InactiveReason

## How to Get Your OAuth Token

1. Open the ShabTzak app in your browser at the deployed URL
2. **Make sure you're logged in** with your Google account
3. Open Chrome DevTools:
   - Press `F12` or right-click → "Inspect"
   - Go to the **Network** tab
4. In the app, perform any action that loads data (e.g., navigate to Soldiers page)
5. In the Network tab, look for requests to `sheets.googleapis.com`
6. Click on one of these requests
7. In the **Headers** section, find the `Authorization` header
8. Copy the token value (it starts after `Bearer `, copy everything after that)
   - Example: `ya29.a0AcM612xyz...` (the actual token is much longer)

## Run the Script

### Option 1: Dry Run (Preview Only)
First, test without making changes:

```bash
node scripts/update-soldiers-sheet.js \
  --token YOUR_TOKEN_HERE \
  --spreadsheet-id 1cFnv_vMZHjVPQS1YsNJwKv4on64uKej0LxwaKsGVouk \
  --dry-run
```

### Option 2: Actual Update
When you're ready to update the Google Sheet:

```bash
node scripts/update-soldiers-sheet.js \
  --token YOUR_TOKEN_HERE \
  --spreadsheet-id 1cFnv_vMZHjVPQS1YsNJwKv4on64uKej0LxwaKsGVouk
```

Replace `YOUR_TOKEN_HERE` with the actual OAuth token you copied.

## What the Script Does

1. ✅ Reads the Soldiers sheet from `test_tables/ShabTzak Data.xlsx`
2. ✅ Clears the entire Soldiers tab in Google Sheets
3. ✅ Writes all 69 rows (header + 68 soldiers) with correct column alignment
4. ✅ Restores all fields: names, roles, phones, units, service dates, etc.

## Expected Output

```
Reading xlsx file: /home/e173165/testDir/ShabTzak/test_tables/ShabTzak Data.xlsx
Found 69 rows (including header)

1. Clearing Soldiers tab...
   ✓ Cleared

2. Writing 69 rows to Soldiers tab...
   ✓ Written

✅ SUCCESS: Soldiers tab updated!
   Total rows: 69 (1 header + 68 soldiers)
```

## Verify the Results

After running the script:

1. Open your Google Spreadsheet
2. Go to the Soldiers tab
3. Check that:
   - All soldiers have correct names (First Name and Last Name columns)
   - Phone numbers are in the Phone column
   - Unit names are correct (e.g., "Command Post", "Operations Room")
   - Service dates are correct (2026-03-27 to 2026-05-25)

## Troubleshooting

### "HTTP 401" or "HTTP 403" Error
- Your OAuth token has expired or is invalid
- Get a fresh token by following the steps above
- Make sure you're logged into the correct Google account

### "HTTP 429" Error
- Rate limit exceeded
- Wait a few minutes and try again

### "Soldiers sheet not found"
- Check that `test_tables/ShabTzak Data.xlsx` exists
- Verify it has a sheet named "Soldiers"

## Code Changes Already Made

The following code has been updated to support the Phone column:
- ✅ `src/models/Soldier.ts` - Added phone field
- ✅ `src/services/soldierRepository.ts` - Updated to 16 columns (A:P)
- ✅ `src/services/parsers.ts` - Added phone parsing
- ✅ `src/services/serializers.ts` - Added phone serialization
- ✅ All tests updated and passing

Once you run the script, the Google Sheet will match the code structure perfectly.
