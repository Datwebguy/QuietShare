# Cloudflare Tunnel (ngrok replacement)

Exposes the extension proxy's external port (host `6674`) over a public HTTPS URL.
Use when ngrok is unavailable. Compose file: `docker-compose.cloudflared.yaml`.

From the repo root, in Git Bash:

**1. Start the tunnel.** Pulls `cloudflare/cloudflared` on first run (cached after that) and
starts the container detached.

```bash
docker compose -f docker-compose.cloudflared.yaml up -d
```

**2. Read the URL it was assigned.** cloudflared prints the generated `*.trycloudflare.com`
hostname once at startup; this greps it back out of the container logs (`tail -1` keeps the
most recent one, in case the container has been restarted).

```bash
docker compose -f docker-compose.cloudflared.yaml logs cloudflared \
  | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1
```

Copy the printed URL into `.env` as `EXT_PROXY_URL=<url>`, **then** start the containers
(`./scripts/start-services.sh --chain coston2`). `start-services.sh` blocks on
`$EXT_PROXY_URL/info`, so a stale URL there is what makes it fail.

Stop: `docker compose -f docker-compose.cloudflared.yaml down`

### Skipping the copy-paste

Since the URL changes on every restart, this does step 2 and writes the result straight into
`.env`, echoing the line back so you can see it landed:

```bash
URL=$(docker compose -f docker-compose.cloudflared.yaml logs cloudflared \
      | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1) \
  && sed -i "s|^EXT_PROXY_URL=.*|EXT_PROXY_URL=$URL|" .env \
  && grep '^EXT_PROXY_URL=' .env
```

Rewrites an existing `EXT_PROXY_URL=` line only — if the echo comes back empty or stale, the
line isn't in your `.env`; add it once by hand and the command works from then on.

## Know this

- **The URL changes on every start.** Quick tunnel, no Cloudflare account — re-copy it after
  any restart. There's deliberately no `restart:` policy, since a silent restart would mint a
  new URL and strand `EXT_PROXY_URL`.
- **The tunnel starts fine with nothing behind it.** It just 502s until the containers are up.
- **No network dependency on the main stack**, so start order doesn't matter.
- Proxy running as a local Go binary (port 6664) instead of Docker? Prefix the first command
  with `TUNNEL_TARGET=http://host.docker.internal:6664`.
