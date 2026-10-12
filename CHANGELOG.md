# Changelog

## Unreleased

## 0.2.0

- Codex models (`openai-codex`) now compact too: after 60 idle minutes, through the same timer and first-message fallback as Anthropic. Codex publishes no cache lifetime, so this is a fixed idle time, not the cache's expiry, and it often compacts a cache that is still warm.

## 0.1.0

- First release: compacts a session once its prompt cache has expired, never while pi's cache warming keeps it alive, and compacts before a message sent after expiry (holding the message if that fails).
