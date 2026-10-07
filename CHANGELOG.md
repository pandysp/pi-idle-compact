# Changelog

## Unreleased

## 0.1.0

- First release: compacts a session once its prompt cache has expired, never while pi's cache warming keeps it alive, and compacts before a message sent after expiry (holding the message if that fails).
