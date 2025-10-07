# Connections Directory

This directory stores successful bank connection data from the Lean SDK integration.

## Structure

- **Individual files**: `connection_YYYY-MM-DDTHH-MM-SS-mmmZ.json` - Timestamped connection records
- **Master log**: `all_connections.json` - Aggregated list of all connections

## Data Format

Each connection file contains:
```json
{
  "entity_id": "uuid",
  "customer_id": "uuid",
  "bank_identifier": "string",
  "consent_attempt_id": "uuid",
  "timestamp": "ISO timestamp",
  "saved_at": "formatted date"
}
```

## Privacy

⚠️ **Note**: All connection JSON files are automatically git-ignored for privacy. Only this README is committed to version control.

If you're cloning this repository, connection data will be generated when you successfully connect a bank account through the application.
