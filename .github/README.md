# ztest

Install the following tools:

- [direnv](https://github.com/direnv/direnv) - loads environment variables
- [OrbStack](https://orbstack.dev) - runs dev containers, local HTTPS/domains, etc.

Run the following commands:

```bash
# Clone and copy empty variables
gh repo clone tmm/ztest
cp .env.example .env
cp .dev.vars.example .dev.vars

pnpm install           # Install local dependencies
docker compose up -d   # Start containers
pnpm db:migrate latest # Setup database and run migrations
pnpm db:codegen        # Generate Kysely/Zero types from database
pnpm gen:types         # Generate Cloudflare types
pnpm test              # Test Zero queries/mutators
```

## License

[MIT](/LICENSE)
