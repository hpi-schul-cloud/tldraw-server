# tldraw-server

Backend for our [tldraw-client](https://github.com/hpi-schul-cloud/tldraw-client). Based on [y-redis](https://github.com/yjs/y-redis).

# tldraw-cli

CLI for tldraw-server based on NestJS REPL module.
You can use it to interact with the tldraw-server infrastructure, e.g., to manage documents stored in Redis.
To start the CLI, run the following command in the terminal:

```bash
npm run cli
```

This will launch the CLI, allowing you to execute commands and interact with the tldraw-cli environment.

## Available Commands

### Clear Pending Document Structures

The `clearPendingDocumentStructs` command is used to fix corrupted Yjs documents by removing pending structures that are blocking document synchronization.

**What it does:**

- Retrieves a document from storage by room ID
- Checks if the document has pending structures (missing/incomplete operations)
- Clears any pending structures that are causing synchronization issues
- Persists the cleaned document back to storage
- Removes old document references to prevent conflicts

**When to use:**

- Document synchronization is failing
- Users report that their changes aren't being saved or synchronized
- You see warning logs about "pending structures" in the server logs
- Document appears corrupted or inconsistent across clients

**Usage:**

```typescript
await $(CliService).clearPendingDocumentStructs(room);
```

**Parameters:**

- `room` (string): The room/document ID to fix

**Returns:**

- `true` if the operation was successful or no pending structures were found
- `false` if the document was not found
- Throws `InternalServerErrorException` if the operation fails

**Example:**

```typescript
// Fix a document with pending structures
await $(CliService).clearPendingDocumentStructs('classroom-123');

// Check multiple rooms
for (const room of ['room1', 'room2', 'room3']) {
	const result = await $(CliService).clearPendingDocumentStructs(room);
	console.log(`Room ${room}: ${result ? 'Fixed' : 'Not found'}`);
}
```

**⚠️ Warning:**
This command modifies document data in storage. Always ensure you have backups and no active users on the document before running this command in production.
