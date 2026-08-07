# Optimal LilacServerCluster black-box?

ZZZ - file is wayyy out of date

From the consumer's perspective:
- Provide nothing more than:
  - Scaling configuration
  - Resources (cpu, ram etc) per instance
  - `launchFn` which can initialize indefinite tasks, e.g. `setInterval`
  - `invokeFn` which can respond to incoming events - a single function to handle e.g. incoming http, incoming websocket message, etc - `invokeFn` fully decides how to route actions
- All code is written in arbitrary typescript functions passed directly to the `LilacServer` instance - exactly as `launchFn` and `invokeFn` are passed to `LilacLambda`
- Get reasonable cost, decent cold-start latency, and very very responsive warm latency
- The resulting deployed infrastructure supports:
  - List existing tasks ("browser lobbies")
  - Create new task ("create a lobby")
  - Connect/disconnect from a task ("join/exit lobby")
    - Overall enabling clients to trigger `invokeFn` within the task's nodejs process
  - Activity tracking; automatic shutdown of idle lobbies

## Proposal #1

- Server control-plane API built on httpgw, lambda and dynamodb
  - Provides create/list/join/disconnect API for clients connecting to servers
  - Enforces upper bound on number of lobbies, to control cost
- Fargate tasks (runtime + data costs) bound to public ipv4 (additional ~$3.65 per month per task) implement "lobbies" - in this context a "task" is pretty much equal to a "lobby"
- Control-plane "join lobby" op essentially tells the client the fargate public ipv4 address (and probably registers the client on the fargate instance, so lobbies can reject non-registered clients)
- Fargate tasks run nodejs server bound to their public ip; trigger `invokeFn` accordingly; lilac verifies client registration and passes client id to `invokeFn`
- Fargate tasks can self-terminate when idle (no registered clients, or no `invokeFn` calls)
- Update behaviour: pre-existing lobbies (tasks) remain alive so long as they are active without receiving updates. Newly-created tasks/lobbies have the updated container config (including updated typescript-transpiled-to-javascript)
- We'll *treat* fargate task death as exceptional - choosing *not* to implement first-class reconnect logic for clients. If a fargate task dies because of a silicon bubble or single event upset, we expect users to have a negative disconnect experience. We'll live with this!
- We'll *make* fargate task death exceptional!
  - Hardened lilac-level (opaque to consumer) network traffic filtering (future improvement: shared-ingress with WAF)
  - Strong consumer controls to limit users per lobby
  - Onus on consumer to write response domain-specific logic running internally on fargate tasks
- Consumer cost is proportional to:
  - Number of active fargate tasks per hour (task runtime plus public ipv4)
  - Data transfer (probably avg_users_per_hour x avg_bytes_per_user_per_hour)
- Consumer cost controls:
  - Configure max # of simultaneous tasks/lobbies
  - Configure max # of users per task

## Future improvements

- Consider shared-ingress; an alb or apigw is the point-of-entry, and maps clients to fargate tasks
  - Adds ~20ms warm latency; saves public-ip-per-task costs
