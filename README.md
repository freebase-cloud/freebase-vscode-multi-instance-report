# freebase-vscode-multi-instance-report

Compare row counts and ID quality across two explicitly selected instances of any supported engine. No instance is created or copied.

## Connect from VS Code

1. Install [Freebase](https://marketplace.visualstudio.com/items?itemName=freebasecloud.freebase-vscode)
   (`code --install-extension freebasecloud.freebase-vscode`).
   See [the install guide](https://freebase.cloud/vscode).
2. Open this folder in a trusted VS Code workspace. Run **Freebase: Sign In** and
   approve the editor connection in your browser. This is separate from a project API key.
3. Choose an existing database. **Freebase: Import Existing Databases** requires
   website sign-in plus a same-account API key; it doesn't copy data.
   **Freebase: Create Database** is optional. The free tier allows one owned instance
   per engine; additional same-engine instances require Pro through the website.
   Sharing remains free.
4. Run **Freebase: Configure Project**, selecting the same instance. It asks before
   writing a working key to your local `.env`. Alternatively copy `.env.example`
   to `.env` and fill it locally. Never paste credentials into chat.
5. Use **Freebase: Run Query**, **Freebase: Open Database**, or **Freebase: Ask Your Data**.
   Check the selected instance and role; shared read-only access cannot write.

Database HTTP API calls include `X-Database-Instance`; MCP uses its token's named connection.
The API key, VS Code browser approval,
and MCP token are different credentials. Connecting all clients to the same instance
shows the same authorized data, never public account-wide data.

## Run

```sh
npm start              # executes on synthetic data without credentials
npm test               # offline safety, transport and domain tests
npm run live           # explicitly access the selected instance

```

Sample input lives in `data/`; the executable implementation is in `src/`.
Live database tools use the engine-neutral Freebase structured dispatch API,
not SQL sent to every engine. Native BSON-only collections may need the native
document interface; unsupported formats fail instead of being converted.
Set `FREEBASE_TABLE` for row reads. Select a compatible flat table.
Multi-instance comparison also requires `FREEBASE_OTHER_INSTANCE_ID` and
`FREEBASE_OTHER_TABLE`; both instances must be authorized by the same API key.
This does not bypass paid limits or create additional instances.




Outputs go to stdout, never overwrite files, and are bounded samples (at most
1000 rows/table, 100 tables for schema discovery). Exact 1000-row reads are flagged
as potentially truncated for JSON exports. There is no pagination/full backup claim.

## Safety and compatibility

- Node.js **22+**; no npm dependencies or install step. All tests run offline.
- These are clients of **Freebase compatibility layers**, not full native database servers,
  separate extensions, or replacement official MCP servers.
- HTTPS is required except explicit loopback HTTP for local API tests. Redirects are
  rejected, requests time out, and writes are **never retried**.
- Default commands preview queries or use synthetic sample files. Live requests need
  your local credentials and explicit flags. Live writes additionally require `--apply`.
- Query translation may use an LLM and is not deterministic (CQL has a dedicated parser).
  A passing offline test does **not** prove a hosted engine or native desktop client works.
- Do not use production data for demos. Data printed to the terminal or exported may
  be sensitive. Use a disposable owned instance or an explicitly permitted test table.
- No transaction, rollback, full-dataset export, native performance, or full SQL/CQL/
  BSON/PromQL compatibility is promised. Reads are bounded and may be incomplete.
- Desktop tools use the website's secure local connectors where provided, not direct
  public native TCP. These HTTPS examples do not need a desktop tunnel.
- Do not commit `.env`, tokens, exports, or logs. No scripts publish to GitHub.
- Offline tests verify transport, safety, plans, and local application logic with mock
  responses. See the collection validation report for exactly what was run.

## Troubleshooting

401: check the credential type and whether it was revoked. 403: check the selected
instance and sharing role. 429: stop and wait; do not retry writes automatically.
An HTTP 200 with an operation error is still a failure. A timeout can follow a
successful write: inspect the named fixture instead of blindly rerunning it.

This example code is MIT licensed. It grants no license to database trademarks,
Freebase's hosted service, or third-party extensions.
