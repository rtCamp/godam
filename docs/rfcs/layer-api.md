# RFC: Layer API

- **Status:** Draft, for review
- **Issue:** #2291 (part of EPIC #2290)
- **Covers:** the decisions the EPIC lists under "To decide", the public names, and what the audit of saved-layer readers found
- **Scope:** the GoDAM plugin only. GoDAM Central adopts the API after it lands here.

## Summary

Let a plugin add a layer type to GoDAM the way it adds a block to WordPress: one `layer.json`, one PHP call, one editor call and one front-end call. Core's own layer types register through the same API. Saved data keeps its current shape, so nothing needs migrating.

## What exists today

A third-party layer type has to wire up five separate mechanisms. godam-for-woo is the only one that does.

| Surface | Mechanism |
|---|---|
| "Add layer" menu entry | PHP filter `godam_video_editor_layer_options` → `window.godamVideoEditorConfig.layerOptions` |
| Settings panel | PHP filter `godam_video_editor_layer_components` + `window.godamLayerComponents` |
| Data for a new layer | `window.godamLayerCreators[ type ]` |
| Player behaviour | `window.godamLayerRegistry.registerLayerType()` or `window.godamLayerRegistryQueue` (documented in `assets/src/js/godam-player/utils/LAYER-REGISTRY-API.md`) |
| Server markup | `do_action( 'godam_player_render_layer', $layer, $instance_id )` |

There is also a sixth, separate path: `GoDAMAPI.createLayer()` creates layers at runtime from code. They have their own `timeupdate` handling and skip hover-preview suppression.

The contract tests added in #2291 pin all of this down. Tests marked "current behaviour" cover things this RFC proposes to change.

## Audit: who reads saved layers

Layers live in the attachment's `rtgodam_meta` post meta, under `layers`. Each one is a flat object: `{ id, type, name, displayTime, ...type-specific keys }`.

### Saving

- **Nothing sanitizes layers on save.** `rtgodam_meta` is a `register_rest_field` on `/wp/v2/media` with no schema and no sanitize callback (`class-meta-rest-fields.php`). Whatever the editor sends is stored.
- **The editor keeps layers it doesn't recognise.** It loads every layer into the store, hides unknown types in the list and timeline, and saves them back unchanged. Deactivating an add-on doesn't lose its layers.

### Exposure

- **REST read access is narrow.** It requires `edit_posts` or `edit_post` on the attachment.
- **Page HTML exposes almost everything.** `godam-player.php` writes every layer, minus `html` and `text`, into the player's public `data-options`. The public `/godam/v1/video-shortcode` route and the embed page return that same markup. A layer type that stored private values would leak them.

### Readers that branch on `type`

| Reader | Unknown type today |
|---|---|
| Player template layer loop (`godam-player.php`) | Falls through to `godam_player_render_layer`. If nothing answers, no container is printed. The whole loop is skipped in WooCommerce contexts. |
| Ad selection (`godam-player.php`, `class-ads.php` `/godam/v1/adTagURL`) | Ignored. Both read `$layer['type']` without `isset`, so a typeless layer causes warnings. |
| Image block (`godam-image/render.php`, `edit.js`, `render-image-frame.js`) | Dropped. A hard allowlist of `hotspot` and `woo`, with no filter. |
| Player JS (`layersManager.js`, `layerValidator.js`) | Passes validation by default. Without a registered manager, the container stays hidden forever and nothing logs it. |
| FontAwesome loader (`pluginLoader.js`) | Only checks `hotspot` and `woo`. |
| Analytics events (`layerActions.js`, analytics service) | Sent, then rejected. The client and the analytics service both allow only `cta`, `form`, `hotspot`, `woo` and `poll`. |
| Analytics REST proxy (`class-analytics.php` `/layer-analytics`) | Rejected with a 400 (same allowlist). |
| Analytics timeline (`useVideoLayerData.js`, `constants/layerTypes.js`) | Not shown (five fixed per-type queries). |
| Editor list, timeline, add menu, settings panel | Hidden. The settings panel falls back to the CTA editor. |
| Image editor (`mediaCapabilities.js`) | Hidden. Allowlist `[ 'hotspot', 'woo' ]`. |
| "Edited" counts (`class-video-editor.php`) | Counted. A serialized `LIKE` counts any layer. |

### Out of scope: GoDAM Central

**This EPIC covers the plugin only.** GoDAM Central's own player and layer handling are out of scope: Central will adopt the Layer API from the plugin once it's done here. Nothing in this RFC waits on Central. No code in the plugin sends `rtgodam_meta.layers` to Central. The only layer data that leaves the site is browser analytics events (see D4).

## Decisions

Each decision gives a recommendation. Where the RFC is agreed differently, the decision is updated here before #2292, #2294 and #2295 start.

### D1. Attribute shape: keep it flat

**Recommendation:** attributes stay top-level keys on the layer, next to `id`, `type`, `name` and `displayTime`. There's no nested `attributes` object.

- Saved data, the player template, the analytics page, godam-for-woo's product SEO sync and the "edited" query all read flat keys today. Nesting would mean a migration and a dual-read period in all of them.
- These core keys are reserved, and a layer type can't declare them as attributes: `id`, `type`, `name`, `displayTime`, `duration`, `allow_skip`, `custom_css`, `trigger`, `watchDepth`.

### D2. Renderers that don't know a type

**Recommendation:** a third-party layer type renders only in the WordPress player and image block. Everything else skips it without errors or warnings. Concretely:

- **Player and image:** print no container and log once in the console (`GoDAM: no runtime registered for layer type "acme/countdown"`). Today the container is printed and stays hidden.
- **Editor:** show the layer in the list with a "Needs an add-on that isn't active" notice, instead of hiding it. Allow deleting it. Never open it in another type's editor.

### D3. Sanitization and privacy

**Recommendation:**

- **Every attribute declares a schema `type`:** `string`, `number`, `integer`, `boolean`, `array` or `object`. A `format` is optional: `url`, `color`, `html` (run through `wp_kses_post`) or `plain` (the default for strings, run through `sanitize_text_field`).
- **Sanitize on save.** On save, each layer of a registered type has its declared attributes sanitized and undeclared keys dropped. Layers of an unregistered type are kept unchanged, because the add-on may come back and D2 keeps them visible in the editor.
- **Private attributes.** An attribute can set `"private": true` to stay out of the public `data-options`. The default is public, so current behaviour is unchanged.
- **Escaping `render_callback` output.** `render_callback` output goes through `wp_kses_post` unless the layer type opts out with `"supports": { "rawHtml": true }`. Opting out is documented as the add-on's responsibility.

### D4. Analytics in v1

**Recommendation:** v1 gives third-party layer types only the baseline actions, viewed and clicked, through `ctx.api.track()`. Custom funnels come in a later version.

- **The analytics service needs changing first.** It rejects any `layer_type` outside its allowlist, so it must accept namespaced types (`vendor/name`) before even the baseline works. Until then, `track()` from a third-party type does nothing and logs a notice once.
- **The analytics page needs a generic per-layer query.** It needs one alongside the five per-type ones, so a namespaced layer type appears on the timeline.
- **This needs the analytics team.** Track it as a dependency of #2294, not as part of it.

### D5. Layers from `GoDAMAPI.createLayer()`

**Recommendation:** run them on the same lifecycle as registered layer types, so hover-preview suppression, resize and fullscreen apply to them too. The public method signature stays the same.

### D6. Front-end registry weight

**Recommendation:** the editor registry is a `@wordpress/data` store (`godam/layers`). The front-end registry stays plain JavaScript. The player script already loads `wp-data`, but the image-layers script loads only `lodash` and `wp-i18n`, and adding `wp-data` there would pull React onto image-only pages.

## Names

| Thing | Name |
|---|---|
| Editor package / script handle / global | `@godam/layers` / `godam-layers` / `window.godam.layers` |
| Editor hooks and controls package | `@godam/layer-editor` / `godam-layer-editor` / `window.godam.layerEditor` |
| Front-end runtime (same package, front-end build) | `registerLayerRuntime()` on `window.godam.layers` |
| Editor registration | `registerLayerType( metadata, { edit, preview } )`, `registerLayerVariation( 'form', … )` |
| Data store | `godam/layers` |
| PHP registration | `godam_register_layer_type( $path_or_metadata, $args )`, called on a new `godam_init` action |
| PHP filter | `godam_layer_type_metadata` |
| JS filter | `godam.layers.registerLayerType` (`@wordpress/hooks`) |
| Metadata file | `layer.json` |

New hooks use the `godam_` prefix, which most of the codebase's hooks already use.

### `layer.json` keys (v1)

| Key | Required | Notes |
|---|---|---|
| `apiVersion` | yes | `1` |
| `name` | yes | `vendor/name`. Core keeps `cta`, `form`, `hotspot`, `poll`, `ad`. |
| `title` | yes | Shown in the "Add layer" menu |
| `description` | no | Second line in the menu |
| `icon` | no | Dashicon name, SVG string or `file:` URL |
| `color` | no | Marker and icon colour |
| `supports` | no | `media` (`[ 'video' ]` by default), `timeline` (`true`), `duplicate` (`true`), `skip` (`false`), `rawHtml` (`false`) |
| `attributes` | no | `{ key: { type, default?, format?, private? } }` |
| `editorScript`, `viewScript`, `style`, `editorStyle` | no | Handles or `file:` paths, as in `block.json` |
| `textdomain` | no | For translating `title` and `description` |

## Fixes the audit found outside this EPIC

These are worth fixing whether or not the Layer API goes ahead:

1. **Typeless layers cause warnings.** `godam-player.php` (ad selection) and `class-ads.php` read `$layer['type']` without `isset`, so a typeless or non-array layer warns on every render and on the public ad-tag route.
2. **The analytics page's "N layers" badge never shows.** `Analytics.js` reads `attachmentData.meta.rtgodam_meta`, but `rtgodam_meta` is a top-level field on `/wp/v2/media`, not part of `meta`.
3. **WooCommerce contexts skip the whole layer loop** in `godam-player.php`, including `godam_player_render_layer`. This may be intended, but it's undocumented.

## Test coverage from #2291

| Area | Test |
|---|---|
| Core layer defaults, add-on menu entries and creators, media gating, unregistered saved layers | `pages/video-editor/components/SidebarLayers.test.js` |
| Settings panel selection, add-on panels, fallbacks, error boundary | `pages/video-editor/components/layers/Layer.test.js` |
| Editor globals add-ons use | `pages/video-editor/index.test.js` |
| Front-end registry, queue, shared store | `assets/src/js/godam-player/utils/layer-registry.test.js` |
| Player dispatch, add-on managers, validation | `assets/src/js/godam-player/managers/layersManager.contract.test.js` |
| Image layers (hotspot, woo, others) | `assets/src/js/godam-image-layers/render-image-frame.test.js` |
| Which saved layers the image block sends | `tests/php/ImageBlockLayerContractTest.php` |

**Not covered:**

- **The player template's layer loop** (`inc/templates/godam-player.php`) and **how `class-pages.php` localizes `layerOptions` / `layerComponents`.** Both need a WordPress install to render, and the PHP suite runs without one. #2295 moves the template loop into `render_callback`s, which can be unit-tested. Until then, these are checked by hand in QA.
- **The real godam-for-woo bundle.** The tests use a stand-in add-on built with the same mechanisms. #2296 runs the real add-on against the new API.
