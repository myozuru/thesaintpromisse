# Tests

- Multiplayer flows are tested with the in-memory fake table (src/test/helpers/fakeMesa.ts) plus pure receive rules (e.g. reduceAmizadeMessage) — simulates several screens in under 1s instead of opening two browser sessions.
- Prompt flows use the real-store jsdom harness in `src/test/helpers/mesaReal.ts`; it mocks cloud/socket and verifies real UI clicks quickly.
