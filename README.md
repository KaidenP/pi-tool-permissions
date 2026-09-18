# pi-tool-permissions

Extension for `@earendil-works/pi-coding-agent` to enforce tool-call permissions.

## Install
`npm install`

## Profiles
- Strict: deny all except read.
- Developer: allow bash/edit with ask.
- Trusted: allow all.

## Example `permissions.yaml`
```yaml
tool: bash
policy: ask
priority: 1
```
