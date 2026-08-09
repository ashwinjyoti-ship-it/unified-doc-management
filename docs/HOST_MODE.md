# Host mode

Tandem can be embedded by a host application that wants Tandem to sit inside its
own visual language — currently Poppin Browser, which opens Tandem as
**Tandem World** in its centre viewing area.

## How a host declares itself

Load Tandem with a `host` query parameter:

```
https://tandem.example.com/?host=poppin
https://tandem.example.com/page/<pageId>?host=poppin
```

`web/src/lib/host.ts` reads the parameter, remembers it in `sessionStorage` so
it survives client-side navigation, and puts a `host-poppin` class on `<html>`.

## What host mode changes

Only visual variables. `html.host-poppin` in `web/src/index.css` remaps the same
CSS custom properties that dark mode remaps:

| Tandem token | Poppin value |
|---|---|
| `--color-paper-white` / `--color-warm-white` | cream surfaces `#fffdf9` |
| page background | warm ivory `#f7f1e7` |
| `--color-charcoal` | near-black `#1d1b19` |
| `--color-forest` (accent) | amber `#ce7a1a` |
| `--color-pedestal` / `--color-green-mist` | Poppin borders and dividers |
| `--font-sans` | Poppin's Inter stack |

Plus Poppin's border, radius and elevation language for cards, buttons and
inputs.

## What host mode must never change

- Information architecture, navigation, routing or component structure.
- Any behaviour, permission or API call.
- Standalone Tandem. With no `host` parameter, nothing above applies and light
  and dark mode behave exactly as before.

## Adding another host

1. Add the name to `SUPPORTED_HOSTS` in `web/src/lib/host.ts`.
2. Add an `html.host-<name>` block in `web/src/index.css` that overrides the
   same variables.

No component changes are required.
