# Proofkeep

Local product and warranty records with serial details, document references, and expiry warnings.

## Run

Run: npm install, npm run dev, npm test, and npm run build.

## Main workflow

Open the workspace, add a validated record, search records, and export your data as Markdown or CSV. Records persist in the browser using localStorage. The app includes a domain-specific interactive helper in its workspace.

## Testing

The Node test suite checks the core export and parsing helpers. A manual smoke workflow is: open the app, save a required record, search it, then use an export button.

## Limitations

Data is stored only in this browser profile; it is not synchronized, encrypted, or backed up automatically. Exports are intentionally simple.

## Future improvements

Add structured import, more domain-specific reports, and optional encrypted local backups.

## Rules

This application is local-first. It does not provide accounts, cloud synchronization, or professional advice. Use verified context before acting on stored information.

## Tests

Run `npm test` for the included logic checks and `npm run build` for the production bundle.
