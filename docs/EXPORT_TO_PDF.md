# How to Export Presentation to PDF

## Method 1: Chrome/Edge Browser (Recommended)

1. Open `presentation.html` in **Google Chrome** or **Microsoft Edge**
2. Press **Ctrl + P** (or click the Print button in the navbar)
3. In the print dialog:
   - **Destination**: Select "Save as PDF"
   - **Layout**: Portrait
   - **Paper size**: A4
   - **Margins**: None
   - **Scale**: 100%
   - ✅ **IMPORTANT**: Enable "Background graphics" checkbox
4. Click **Save**

## Method 2: Firefox

1. Open `presentation.html` in **Firefox**
2. Press **Ctrl + P**
3. In the print dialog:
   - **Destination**: Save to PDF
   - **Paper size**: A4
   - **Orientation**: Portrait
   - ✅ **IMPORTANT**: Enable "Print backgrounds"
4. Click **Save**

## Expected Result

- Each slide will be on a separate A4 page
- All colors, gradients, and backgrounds preserved
- Dark background (#2b2b2b) maintained
- Windows XP-style mockups with all colors intact
- Tables with blue headers and alternating row colors
- Status badges (red/green/yellow) fully visible
- Code blocks with dark theme
- All SVG charts and diagrams rendered perfectly

## Troubleshooting

### If colors are missing:
- Make sure "Background graphics" (Chrome/Edge) or "Print backgrounds" (Firefox) is enabled
- Try reloading the page with Ctrl + F5
- Ensure you're using a modern browser (Chrome 90+, Edge 90+, Firefox 90+)

### If pages are cut off:
- Set margins to "None" or "Minimum"
- Ensure scale is at 100%
- Select A4 paper size (not Letter)

### If SVG charts are missing:
- This shouldn't happen with the current CSS, but if it does, try Chrome instead

## File Info

- **Total slides**: 20
- **Expected PDF size**: ~2-3 MB
- **Format**: A4 portrait (210mm × 297mm)
- **Each slide**: One per page with page breaks
