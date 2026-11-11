# Frontier Model Capability Test

A collection of browser-based 3D scenes. Each scene lives in its own top-level folder; `index.html` at the root is a landing page that links to them.

| Scene | Folder | Details |
|---|---|---|
| Marble Cathedral | [`marble-cathedral/`](marble-cathedral/) | [README](marble-cathedral/README.md) |

## Running locally

```sh
python3 -m http.server 8377   # then open http://localhost:8377
```

## Adding a scene

1. Put it in a new top-level folder with its own `index.html`, using relative paths only.
2. Add an entry (title, folder, blurb, thumbnail) to `projects.js`.
