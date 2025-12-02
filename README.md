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

For clearPendingDocumentStructs command:

```typescript
await $(CliService).clearPendingDocumentStructs(room: string): Promise<boolean>
```
