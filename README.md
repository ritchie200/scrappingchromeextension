# Visible Contact Name Extractor

A small Chrome Extension for pulling likely person names from the visible text on the page you are currently viewing.

It is meant for quick, manual cleanup work where the names are already visible on the page. It does not use a backend, external API, tracking script, or analytics service.

## What It Does

- Scans visible text from the current page only after you click **Scan Page**.
- Looks for likely person names using simple patterns and heuristics.
- Removes duplicates.
- Marks each match as high, medium, or low confidence.
- Lets you select or unselect names before copying or exporting.
- Exports selected names to CSV with the source page title and URL.

## What It Does Not Do

- It does not bypass logins, paywalls, CAPTCHA, anti-bot systems, or site restrictions.
- It does not auto-crawl pages or follow links.
- It does not run in the background to collect data.
- It does not scrape hidden DOM text, form values, attributes, private data, emails, or phone numbers.
- It does not send page content anywhere.

## Privacy And Compliance

This extension only reads visible text from the active page when you manually start a scan. You are responsible for following the website's terms, privacy rules, and any laws that apply to the data you export.

Do not use it to collect information that you are not allowed to use. If a site restricts scraping or automated extraction, respect those restrictions.

## Install In Chrome Developer Mode

1. Clone or download this folder.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select this project folder.
6. Pin the extension if you want it visible in the toolbar.

## How To Use

1. Open a normal `http` or `https` web page.
2. Click the extension icon.
3. Click **Scan Page**.
4. Review the detected names.
5. Uncheck anything you do not want.
6. Use **Copy Selected** or **Export CSV**.
7. Use **Clear** to reset the popup results.

## Current Limitations

- Name detection is heuristic-based, so false positives and missed names are expected.
- It works best on pages with names near labels like "by", "author", "contact", "founder", "director", or job titles.
- It only scans the main page DOM, not cross-origin iframe contents.
- Very large pages are capped to keep the popup responsive.
- It only supports Chrome-compatible Manifest V3 browsers.

## Future Improvements

- Better handling for international names.
- Optional allowlist or blocklist terms for specific workflows.
- More detailed match reasons in the UI.
- Local-only import/export of parser settings.
- Better accessibility testing across Chrome versions.

## Support

If you find this project useful, please consider starring the repository.  
It helps support the project and shows employers/other developers that the work is useful.

You are free to fork the project for learning purposes. Please keep the license and attribution intact.

## License

MIT License. See [LICENSE](LICENSE).
