# GoDAM Layer API

Build your own layer types for GoDAM videos and images, the way you build blocks for the WordPress block editor.

A layer is something that appears on top of a video or image: a call to action, a form, a poll, a hotspot, a product card. GoDAM's own layer types (CTA, Form, Poll, Hotspot and Ad) are registered through this same API, so an add-on's layer type gets the same treatment: an entry in the "Add layer" menu, a settings panel, a timeline marker, saving, and rendering in the player and on `godam/image` blocks.

> **Requires GoDAM 2.9.0.** The older add-on hooks still work until 2.11.0, with deprecation notices. See [Moving from the old hooks](#moving-from-the-old-hooks).

## Contents

- [How a layer type fits together](#how-a-layer-type-fits-together)
- [Quick start: a countdown layer](#quick-start-a-countdown-layer)
- [`layer.json`](#layerjson)
- [PHP](#php)
- [Editor](#editor)
- [Front end](#front-end)
- [Form providers](#form-providers)
- [Saved layer data](#saved-layer-data)
- [Analytics](#analytics)
- [Moving from the old hooks](#moving-from-the-old-hooks)
- [Troubleshooting](#troubleshooting)

## How a layer type fits together

A layer type has one metadata file and up to three parts. Each part registers under the same name.

| Part | Runs in | Registers with | Does |
|---|---|---|---|
| `layer.json` | everywhere | read by the PHP call | Name, title, colour, which media it supports, its attributes, its scripts |
| PHP | the server | `godam_register_layer_type()` | Prints the layer's container in the player, says whether the type can run on this site, cleans its data on save |
| Editor script | the video editor | `window.godam.layers.registerLayerType()` | The settings panel, what a new layer starts with, availability in the "Add layer" menu |
| View script | the page | `window.godam.layers.registerLayerRuntime()` | Shows and hides the layer, reacts to playback, resize and fullscreen, on video and images |

**GoDAM's own layer types follow the same structure.** Each lives in its own folder, the way Gutenberg's core blocks live in `packages/block-library/src/<block>/`:

```
assets/src/layers/cta/
├── layer.json   metadata (viewScript: "file:./view.js")
├── cta.php      render callback + godam_register_layer_type()
├── editor.js    registerLayerType() settings (title, icon, edit, …)
├── edit.js      the settings panel
└── view.js      registerLayerRuntime()
```

The build copies `layer.json` and the PHP to `assets/build/layers/cta/` beside the built `view.js` and `view.asset.php`, and GoDAM registers the type from there. The `cta`, `form`, `poll`, `hotspot` and `ad` folders are working examples of everything below.

**Naming:** third-party layer types need a namespace, for example `acme/countdown`, made of lowercase letters, digits and dashes. That's the value saved in each layer's `type`, so pick it once and keep it.

## Quick start: a countdown layer

A plugin that adds a "Countdown" layer: a message that appears at a chosen time and counts down to a date.

```
acme-countdown/
├── acme-countdown.php
├── layer.json
├── package.json
├── src/
│   ├── editor.js
│   └── view.js
└── build/            ← created by `npm run build`
    ├── editor.js, editor.asset.php
    └── view.js, view.asset.php
```

### `layer.json`

```json
{
	"apiVersion": 1,
	"name": "acme/countdown",
	"title": "Countdown",
	"description": "Count down to a date",
	"color": "#e24a4a",
	"supports": {
		"media": [ "video", "image" ]
	},
	"attributes": {
		"label": { "type": "string", "default": "Sale ends in" },
		"endsAt": { "type": "string", "default": "" },
		"duration": { "default": 10 }
	},
	"editorScript": "file:./build/editor.js",
	"viewScript": "file:./build/view.js",
	"textdomain": "acme-countdown"
}
```

### `acme-countdown.php`

```php
<?php
/**
 * Plugin Name: Acme Countdown Layer
 * Requires Plugins: godam
 */

add_action(
	'godam_init',
	function () {
		godam_register_layer_type(
			__DIR__ . '/layer.json',
			array(
				// The container the player shows and hides. Keep the id and classes.
				'render_callback' => function ( $layer, $instance_id ) {
					return sprintf(
						'<div id="%1$s" class="easydam-layer hidden acme-countdown"><p class="acme-countdown__label">%2$s</p><p class="acme-countdown__time" data-ends-at="%3$s"></p></div>',
						esc_attr( 'layer-' . $instance_id . '-' . $layer['id'] ),
						esc_html( $layer['label'] ?? '' ),
						esc_attr( $layer['endsAt'] ?? '' )
					);
				},
			)
		);
	}
);
```

`godam_init` fires on `init`. Registering there means the type exists before anything renders, saves or loads the editor.

### `src/editor.js`

```js
import { __ } from '@wordpress/i18n';

const { registerLayerType } = window.godam.layers;
const { useLayerAttributes, LayersHeader, VeSection, VeTextInput } = window.godam.layerEditor;

function CountdownPanel( { layerID, goBack, duration } ) {
	const [ layer, setAttributes ] = useLayerAttributes( layerID );
	if ( ! layer ) {
		return null;
	}

	return (
		<>
			<LayersHeader layer={ layer } goBack={ goBack } duration={ duration } layerName={ __( 'Countdown', 'acme-countdown' ) } />
			<VeSection title={ __( 'Countdown', 'acme-countdown' ) }>
				<VeTextInput
					label={ __( 'Label', 'acme-countdown' ) }
					value={ layer.label }
					onChange={ ( label ) => setAttributes( { label } ) }
				/>
				<VeTextInput
					label={ __( 'Ends at', 'acme-countdown' ) }
					type="datetime-local"
					value={ layer.endsAt }
					onChange={ ( endsAt ) => setAttributes( { endsAt } ) }
				/>
			</VeSection>
		</>
	);
}

// Name, title, colour, supports and attributes come from layer.json, which
// GoDAM passes to the editor from PHP. The script adds what only JS can provide.
registerLayerType( 'acme/countdown', {
	title: __( 'Countdown', 'acme-countdown' ),
	edit: CountdownPanel,
} );
```

### `src/view.js`

```js
const { registerLayerRuntime } = window.godam.layers;

registerLayerRuntime( 'acme/countdown', {
	supports: { media: [ 'video', 'image' ] },

	mount( { layer, container, media, api } ) {
		// On video the container holds the markup render_callback printed. On an
		// image it's an empty wrapper, so draw the markup here.
		if ( ! container.querySelector( '.acme-countdown__time' ) ) {
			container.innerHTML = '<div class="acme-countdown"><p class="acme-countdown__label"></p><p class="acme-countdown__time"></p></div>';
			container.querySelector( '.acme-countdown__label' ).textContent = layer.label || '';
		}
		const time = container.querySelector( '.acme-countdown__time' );
		const tick = () => {
			const seconds = Math.max( 0, Math.round( ( new Date( layer.endsAt ) - Date.now() ) / 1000 ) );
			time.textContent = `${ Math.floor( seconds / 3600 ) }h ${ Math.floor( ( seconds % 3600 ) / 60 ) }m ${ seconds % 60 }s`;
		};
		const timer = setInterval( tick, 1000 );
		tick();

		// On an image there's no timeline: show the layer straight away.
		if ( media.type === 'image' ) {
			api.show();
			return { destroy: () => clearInterval( timer ) };
		}

		const start = Number( layer.displayTime ) || 0;
		const end = start + ( Number( layer.duration ) || 10 );

		return {
			onTimeUpdate( currentTime ) {
				if ( currentTime >= start && currentTime <= end ) {
					api.show();
				} else {
					api.hide();
				}
			},
			destroy: () => clearInterval( timer ),
		};
	},
} );
```

### Build

```json
{
	"scripts": {
		"build": "wp-scripts build src/editor.js src/view.js"
	},
	"devDependencies": {
		"@wordpress/scripts": "^30"
	}
}
```

`wp-scripts` writes the `*.asset.php` files GoDAM reads for each script's dependencies and version. GoDAM also adds its own dependencies:
- **Editor scripts** get `godam-layers` and `godam-layer-editor`.
- **View scripts** get `godam-layer-runtime`.

So `window.godam.layers` and `window.godam.layerEditor` are always ready when your script runs.

**What you get:**
- **In the video editor,** "Countdown" appears in **Add layer**, opens your panel, and gets a timeline marker in its colour.
- **On save,** the layer is saved into the attachment's `rtgodam_meta.layers` and cleaned against your declared attributes.
- **On the front end,** your container is printed in the player. `view.js` loads only on pages that show a countdown layer, and the layer works on videos and on `godam/image` blocks.

## `layer.json`

| Key | Type | Notes |
|---|---|---|
| `apiVersion` | number | `1` |
| `name` | string | **Required.** `vendor/name`. Saved in each layer's `type`. |
| `title` | string | **Required** (here or in the editor call). Shown in the "Add layer" menu and the layer list. |
| `description` | string | Shown under the title in the menu. |
| `icon` | string | Dashicon name or an image URL. In PHP you can also pass `iconUrl`. |
| `color` | string | The timeline marker colour. |
| `supports` | object | See below. |
| `attributes` | object | Your layer's settings and their schemas. See [Attributes](#attributes). |
| `variationAttribute` | string | The attribute that selects a variation (the Form type uses `form_type`). |
| `editorScript` | string or array | `file:./path.js` relative to `layer.json`, or a registered script handle. |
| `viewScript` | string or array | Same, for the page. |
| `style` | string or array | `file:./path.css` relative to `layer.json`, or a registered style handle. Loads on the page **and** in the video editor. |
| `viewStyle` | string or array | Same, for the page only. |
| `editorStyle` | string or array | Same, for the video editor only. |
| `textdomain` | string | Your text domain. GoDAM translates `title`, `description` and variation titles with it. See [Translations](#translations). |

### `supports`

| Key | Default | Meaning |
|---|---|---|
| `media` | `[ "video" ]` | Where the type works: `video`, `image`, or both. |
| `timeline` | `true` | The layer has a time on the video timeline. |
| `duplicate` | `true` | Editors can duplicate the layer. |
| `skip` | `false` | The layer has a skip button. |
| `rawHtml` | `false` | Your `render_callback` output is printed as is instead of through `wp_kses_post()`. You become responsible for escaping it. |

### Attributes

Attributes are your layer's settings. They're stored **flat** on the layer next to GoDAM's own keys (see [Saved layer data](#saved-layer-data)).

```json
"attributes": {
	"label":    { "type": "string", "default": "" },
	"seconds":  { "type": "integer", "default": 10 },
	"loop":     { "type": "boolean", "default": false },
	"link":     { "type": "string", "format": "url" },
	"note":     { "type": "string", "format": "html" },
	"accent":   { "type": "string", "format": "color", "default": "#e24a4a" },
	"items":    { "type": "array", "default": [] },
	"iconId":   { "type": [ "integer", "null" ], "default": null },
	"apiToken": { "type": "string", "private": true }
}
```

- **`type`:** `string`, `number`, `integer`, `boolean`, `array`, `object`, or a list such as `[ "integer", "null" ]`.
- **`format`** (strings): `plain` (default, `sanitize_text_field()`), `html` (`wp_kses_post()`), `url` (`esc_url_raw()`) or `color` (one plain colour: hex, `rgb()`/`rgba()`, `hsl()`/`hsla()` or a named colour such as `transparent`, checked with `rtgodam_sanitize_css_color()`).
- **`default`:** what a new layer starts with, and what a value of the wrong type falls back to on save.
- **`private`:** `true` keeps the attribute out of the page. It's saved and visible in the editor, but left out of the player's and image block's layer data.

**Shared keys:** a type may set the *default* of a key GoDAM shares across layer types (`duration`, `allow_skip`, `custom_css`, `trigger`, `watchDepth`). It can't change their type, and it can't declare GoDAM's managed keys at all (`id`, `type`, `name`, `displayTime`).

## PHP

### `godam_register_layer_type( $path_or_metadata, $args = array() )`

Call it on `godam_init`. Returns the registered type, or `false` with a `_doing_it_wrong()` notice when it's rejected: no name, a name already registered, or a `layer.json` that can't be read.

`$path_or_metadata` is a `layer.json` file, the folder that holds one, or the metadata as an array. `$args` is merged over the metadata:

| Arg | Signature | Meaning |
|---|---|---|
| `render_callback` | `( $layer, $instance_id, $context ) => string` | The layer's container in the player. `$context` is `array( 'media' => 'video' )`. Return `''` to print nothing (for example, when a required setting is empty). |
| `is_available` | `( $layer = null ) => bool` | Whether the type can run on this site, e.g. a required plugin or API key. The editor greys out an unavailable type. |
| `dependency_key` | string | Reports `is_available` to the player as `window.godamPluginDependencies[ key ]`. |
| `should_render` | `( $layer, $context ) => bool` | Whether a saved layer is worth sending to an image block, e.g. it has content. |
| `keep_undeclared_attributes` | bool | Keep keys your `layer.json` doesn't declare when a layer is saved. See [Cleaning on save](#cleaning-on-save). |
| `variations` | array | Variations, as for `godam_register_layer_variation()`. |
| any metadata key | | Overrides `layer.json`, for example `iconUrl` built from your plugin URL. |

**The container.** The player finds each layer by its element id and toggles the `hidden` class:

```html
<div id="layer-{instance_id}-{layer id}" class="easydam-layer hidden …">…</div>
```

Keep that id and those two classes. Everything inside the container is yours. Output goes through `wp_kses_post()` unless `supports.rawHtml` is `true`. If your markup includes forms, inputs or scripts, set `rawHtml` and escape everything yourself.

Images don't use `render_callback`: the image block gives each layer an empty wrapper, and your view script draws into it.

### Other functions

| Function | Does |
|---|---|
| `godam_get_layer_type( $name )` | The registered type, or `null`. |
| `godam_unregister_layer_type( $name )` | Removes a type. Returns the type or `false`. |
| `godam_register_layer_variation( $name, $variation )` | Adds a variation to a type, e.g. a form provider to `form`. See [Form providers](#form-providers). |
| `godam_render_layer( $layer, $instance_id, $context )` | The container markup for one saved layer, as the player template prints it. |

### Hooks

| Hook | Type | Use |
|---|---|---|
| `godam_init` | action | Register layer types and variations. |
| `godam_layer_type_metadata` | filter | Change any type's metadata before it registers, including GoDAM's own. |
| `godam_plugin_dependencies` | filter | Add or change the availability flags the player reads. |

### Cleaning on save

When the editor saves `rtgodam_meta`, GoDAM cleans every layer of a registered type:

1. **Declared attributes** are sanitized by `format`.
2. **A value of the wrong type** is converted when nothing is lost (`"30"` → `30` for an `integer`). If it can't be converted, it falls back to the attribute's `default`, or is removed when there's no default.
3. **Undeclared keys are dropped**, unless the type registered with `keep_undeclared_attributes`.

GoDAM's own types keep undeclared keys for now, and keep `html` as written (it's escaped when it renders). Their `layer.json` files don't list every attribute they save yet. Layers of a type nobody registered are kept unchanged, in case the add-on that owns them comes back.

**Declare every attribute you save.** Anything you leave out of `attributes` is deleted the next time the layer is saved.

### Loading scripts and styles

- **`editorScript`** and **`editorStyle`** load on the video editor page.
- **`viewScript`** and **`viewStyle`** load only when a layer of your type renders on the page, or is sent to a `godam/image` block. A page with no countdown layers never loads `view.js` or `view.css`.
- **`style`** loads wherever either of them does.
- **In the block editor,** the `godam/image` block draws its layer preview inside the editor canvas, so the `style` and `viewStyle` of every type that supports images load there too. Their view scripts load in the editor window, as before.
- **Page-builder editors** (Elementor, and shortcodes rendered over AJAX) load every type's view scripts and styles up front, since assets enqueued during an AJAX render never print.

A `file:` script is registered only once it's built, with the `*.asset.php` `wp-scripts` writes beside it. A `file:` style is registered once the `.css` file exists, and if `wp-scripts` also wrote a `*-rtl.css` beside it, that file replaces it on right-to-left sites. Handles follow the block naming: `acme-countdown-style`, `acme-countdown-view-style`, `acme-countdown-editor-style`, with `-2`, `-3`… for the second and later entries of an array. GoDAM's own types use a `godam-layer-` prefix, for example `godam-layer-hotspot-view-script`.

To build a stylesheet with `wp-scripts`, import it from the script that uses it, for example `import './view.scss';` in `src/view.js`, and point `viewStyle` at the CSS file the build writes (`file:./build/view.css`).

### Translations

**`layer.json` strings.** When `layer.json` sets `textdomain`, GoDAM translates its strings in PHP the way WordPress translates `block.json`:

| Key | Gettext context |
|---|---|
| `title` | `layer title` |
| `description` | `layer description` |
| `variations[].title` | `layer variation title` |
| `variations[].description` | `layer variation description` |

A string with no translation in its context falls back to your text domain's translation of the same string without a context, so a `__( 'Countdown', 'acme-countdown' )` you already have elsewhere also covers the `layer.json` title. The editor uses the translated title and description over the ones in the `layer.json` your editor script imports, so you don't need to repeat them in `godam_register_layer_type()` or in `registerLayerType()` settings. `wp i18n make-pot` reads `block.json` files but not `layer.json`, so add these strings to your POT file yourself.

**Script translations.** Each `file:` script is set up with `wp_set_script_translations()` for your `textdomain`, using WordPress's own lookup (`wp-content/languages/plugins/`). Don't override the path unless your plugin ships its translations elsewhere.

## Editor

The editor registry is `window.godam.layers` (script handle `godam-layers`). Panel hooks and controls are on `window.godam.layerEditor` (handle `godam-layer-editor`). If you bundle with webpack, you can import them instead by declaring externals:

```js
// webpack.config.js
externals: {
	'@godam/layers': [ 'godam', 'layers' ],
	'@godam/layer-editor': [ 'godam', 'layerEditor' ],
},
```

### `registerLayerType( metadataOrName, settings )`

`metadataOrName` is your `layer.json` contents or just the name. Metadata the type registered in PHP fills in anything you don't pass, so `registerLayerType( 'acme/countdown', { edit } )` is enough. Returns the registered type, or `undefined` with a console error.

| Setting | Meaning |
|---|---|
| `edit` | **The settings panel**, a React component. It receives `{ layerID, goBack, duration }`. |
| `create( { layers, currentTime, type } )` | The new layer, including `type` and `displayTime` (usually `currentTime`). GoDAM always sets `id`, and sets `name` when you don't. Without `create`, a new layer gets `type`, the time and your attribute defaults. |
| `getAvailability( { videoConfig, mediaType } )` | `{ available: false, reason }` to grey the type out in the menu with a tooltip, or `null` when available. Add `disablesExisting: false` to keep existing layers editable. |
| `validate( layer )` | Return `false` to block saving, e.g. a required setting is empty. The editor shows a message listing the layer's time. |
| `title`, `label`, `description` | Translated strings. `label` is the menu text and defaults to `title`. |
| `icon`, `iconUrl`, `color` | How the type looks in the menu, the layer list and the timeline. |
| `markerIcon` | A component drawn inside the timeline marker. |
| `supports`, `attributes`, `variationAttribute`, `variations` | As in `layer.json`. |

Other registry functions: `unregisterLayerType()`, `getLayerType()`, `getLayerTypes()`, `registerLayerVariation()`, `unregisterLayerVariation()`, `getLayerVariationByName()`, `getDefaultAttributes()`, `getLayerVariation()`, `getAvailability()` and `supportsMedia()`.

The **`godam.layers.registerLayerType`** filter (`@wordpress/hooks`) changes a type's settings as it registers:

```js
wp.hooks.addFilter( 'godam.layers.registerLayerType', 'acme/tweak-cta', ( settings, name ) =>
	name === 'cta' ? { ...settings, color: '#000' } : settings
);
```

### Panel hooks (`window.godam.layerEditor`)

| Hook | Returns |
|---|---|
| `useLayerAttributes( layerId )` | `[ layer, setAttributes( changes ) ]`. `setAttributes` merges changes into the layer and ignores `id` and `type`. |
| `useLayer( layerId )` | The layer. Without an id, the layer whose panel is open. |
| `useMediaType()` | `'video'` or `'image'`. |

Use these instead of reading the editor's Redux store. The store's shape isn't part of the API.

### Panel components (`window.godam.layerEditor`)

| Component | Use |
|---|---|
| `LayersHeader` | The panel header with the back button and layer name. Props: `layer`, `goBack`, `duration`, `layerName`. |
| `LayerCanvas` | Renders its children on top of the video stage, for an on-stage preview. |
| `VeSection` | A titled section (`title`). |
| `VeTextInput` | A text field (`label`, `value`, `onChange( value )`, `type`, `help`, `error`). |
| `VeSegmented`, `VeRadioGroup`, `VeColorList` | Option pickers. |
| `FontAwesomeIconPicker`, `ColorPickerButton` | The icon and colour pickers GoDAM's own panels use. |
| `formatClock( seconds )`, `parseClock( text )` | `m:ss` time formatting for time fields. |

## Front end

The runtime registry is `window.godam.layers` (handle `godam-layer-runtime`). It's plain JavaScript with no React, so it's cheap on image-only pages.

### `registerLayerRuntime( name, settings )`

| Setting | Meaning |
|---|---|
| `mount( ctx )` | **Required.** Called once per saved layer. Returns handlers (below), or nothing. |
| `supports` | `{ media: [ 'video', 'image' ] }`. Defaults to video only. Image blocks only mount types that list `image`. |
| `validate( layer, { dependencies } )` | Return `false` to skip the layer. `dependencies` is `window.godamPluginDependencies`. |
| `usesIconFont( layer )` | Return `true` to have FontAwesome loaded before the layer mounts. |
| `title` | Label used in analytics names. |
| `variationAttribute`, `variations` | As in the editor. |

A layer whose runtime isn't registered yet is kept back and mounted as soon as its view script registers it, so a view script that loads late (deferred or delayed by an optimisation plugin) still works. Until then the console logs `GoDAM: no runtime registered for layer type "…"` once. `whenLayerRuntime( name, callback )` runs `callback( runtime )` once a runtime registers, or straight away if it already has; it returns a function that stops waiting.

The same goes for variations: a layer whose variation isn't registered yet (an add-on form provider whose script loads after the player) is mounted once `registerLayerRuntimeVariation()` adds it. `whenLayerRuntimeVariation( name, layer, callback )` runs `callback( runtime )` once the runtime has a variation matching `layer`.

### `mount( ctx )`

| `ctx` | |
|---|---|
| `layer` | The saved layer (without private attributes). |
| `container` | The layer's element: your `render_callback` output on video, an empty wrapper on images. It starts with the `hidden` class. |
| `player` | The Video.js player. On images, a stand-in with the same methods (`el()`, `currentTime()` returns 0, `pause()` and `play()` do nothing) plus `computeContentRect()`, the image's box. |
| `media` | `{ type: 'video' \| 'image', element }`. |
| `instanceId` | The player instance. |
| `shared( key, create )` | A value shared by every layer on the same video or image, created on first use. |
| `api` | `show()`, `hide()`, `isVisible()`, `pause()`, `play()`, `seek( seconds )`, `currentTime()`, `isSuppressed()`, `track( action, metadata )`. |

### Handlers

Every handler is optional.

| Handler | Called |
|---|---|
| `onReady()` | Once every saved layer on the video or image is mounted. |
| `onTimeUpdate( currentTime )` | On every playback time update. |
| `onPause()` | When the viewer pauses. Automatic pauses don't count, such as the player scrolling out of view. |
| `onEnded()` | When playback ends. |
| `onPlay()` | When playback starts. |
| `onResize()` | When the video or image box changes size. |
| `onFullscreenChange( isFullscreen, playerElement )` | On entering or leaving fullscreen. |
| `onReplay()` | When the player API replays from the start. |
| `destroy()` | When the layer is unmounted (the image block redraws in the editor). |

- **During a hover preview** (the muted "Start Preview" playback), `onTimeUpdate`, `onPause` and `onEnded` aren't called, so no layer appears early.
- **To get each event once for all your layers,** return the same handlers object from several mounts. Usually that means one controller per player, kept with `ctx.shared()`:

```js
mount( ctx ) {
	const controller = ctx.shared( 'acme/countdown', () => createController( ctx ) );
	controller.add( ctx.layer, ctx.container );
	return controller.handlers; // the same object for every countdown layer on this player
}
```

- **An error** thrown from `mount()` or a handler is logged, and every other layer keeps running.

## Form providers

The Form layer is one type with a **variation per form plugin**, selected by the layer's `form_type`. To add a form plugin, register a variation in each place it needs one.

**PHP** prints the form and says whether the plugin is active:

```php
add_action( 'godam_init', function () {
	godam_register_layer_variation( 'form', array(
		'name'            => 'acme-forms',            // saved as form_type
		'title'           => 'Acme Forms',
		'is_available'    => fn () => class_exists( 'Acme_Forms' ),
		'dependency_key'  => 'acmeForms',             // window.godamPluginDependencies.acmeForms
		'render_callback' => function ( $layer ) {    // inner markup; '' prints no layer
			return empty( $layer['acme_form_id'] ) ? '' : do_shortcode( sprintf( '[acme_form id="%d"]', $layer['acme_form_id'] ) );
		},
		'attributeSchema' => array( 'acme_form_id' => array( 'type' => 'integer' ) ),
		'container_class' => 'acme-forms',            // optional extra class on the layer container
	) );
} );
```

**Editor:** the form picker. Either bring your own `edit` panel, or give GoDAM two functions and it builds the panel (form picker, preview and Edit Form link) for you:

```js
window.godam.layers.registerLayerVariation( 'form', {
	name: 'acme-forms',
	title: 'Acme Forms',
	icon: 'feedback',
	idField: 'acme_form_id',                          // where the chosen form's ID is saved
	isAvailable: () => !! window.godamVideoEditorConfig?.layerAvailability?.form?.variations?.[ 'acme-forms' ],
	unavailableReason: 'Activate Acme Forms to use this.',
	settingsUrl: 'admin.php?page=acme-forms&form={formId}', // or ( formId ) => url
	getForms: async () => [ { id: 7, title: 'Contact' } ],
	getFormHtml: async ( id ) => ( await fetch( `/wp-json/acme/v1/forms/${ id }/html` ) ).text(),
} );
```

**Front end:** tells GoDAM when the form was sent, so the skip button turns into "Continue" and a `submitted` event is recorded:

```js
window.godam.layers.registerLayerRuntimeVariation( 'form', {
	name: 'acme-forms',
	title: 'Acme Forms',                              // the label in analytics names
	isAvailable: ( dependencies ) => !! dependencies?.acmeForms,
	isSubmitted: ( element ) => !! element.querySelector( '.acme-form-sent' ),
	isUnavailable: ( element ) => !! element.querySelector( '.acme-form-error' ), // optional: let the viewer continue, record nothing
} );
```

A variation registered before its type is kept and added when the type registers, so script order doesn't matter.

## Saved layer data

Layers are saved on the attachment in the `rtgodam_meta` post meta, as `rtgodam_meta.layers`, a list of flat objects:

```json
{ "id": "6c0f…", "type": "acme/countdown", "name": "Countdown Layer", "displayTime": 12.5, "duration": 10, "label": "Sale ends in", "endsAt": "2026-12-01T09:00" }
```

| Key | Owner |
|---|---|
| `id`, `type`, `name`, `displayTime` | GoDAM (managed) |
| `duration`, `allow_skip`, `custom_css`, `trigger`, `watchDepth` | Shared by all types |
| everything else | Your type's `attributes` |

The editor reads and writes this through `/wp/v2/media/{id}` (the `rtgodam_meta` field). Saving through that route runs the [cleaning](#cleaning-on-save).

## Analytics

`ctx.api.track( action, metadata )` records a layer interaction, once per layer and action per page.

**Limitation:** GoDAM's analytics service accepts only GoDAM's own layer types today (and `woo`). For any other type, `track()` records nothing and logs `GoDAM: analytics doesn't record layer type "…" yet.` once. Support for namespaced types needs a change on the analytics service, which is planned.

## Moving from the old hooks

These still work until **GoDAM 2.11.0**. Each logs a deprecation notice when used: in PHP through `_deprecated_hook()` (with `WP_DEBUG`), in JS in the console once per page.

| Deprecated since 2.9.0 | Use instead |
|---|---|
| `godam_video_editor_layer_options` filter | `godam_register_layer_type()`, plus `getAvailability` in the editor |
| `godam_video_editor_layer_components` filter | `godam_register_layer_type()` with an `editorScript` |
| `godam_player_render_layer` action | `render_callback` |
| `window.godamLayerComponents` | the `edit` setting of `registerLayerType()` |
| `window.godamLayerCreators` | the `create` setting of `registerLayerType()` |
| `window.godamVideoEditorActions` (`updateLayerField`) | `useLayerAttributes()` |
| `window.godamLayerRegistry.registerLayerType()` and `window.godamLayerRegistryQueue` | `registerLayerRuntime()` |
| reading `state.videoReducer` with your own react-redux | `useLayer()`, `useLayerAttributes()`, `useMediaType()` |

**Keep your type's name.** Renaming it would orphan layers already saved with the old `type`. Types saved before the Layer API without a namespace (godam-for-woo's `woo`) are allowed to keep it.

godam-for-woo's move to this API is a worked example of a full migration: rtCamp/godam-for-woo#251.

## Troubleshooting

| You see | Why |
|---|---|
| The type isn't in **Add layer** | The editor script didn't run, or `registerLayerType()` was rejected (check the console for `GoDAM: layer type names must be namespaced…`). Or `supports.media` doesn't include the media open in the editor. |
| "This layer needs an add-on that isn't active" in a layer's panel | The editor has a saved layer whose type nobody registered in JS. The layer is kept until someone deletes it. |
| `GoDAM: no runtime registered for layer type "…"` | The view script hasn't loaded, or didn't call `registerLayerRuntime()`. The layer mounts if the runtime registers later. Otherwise it stays hidden. |
| The layer never appears on the video | `render_callback` returned `''`, the container's id doesn't match `layer-{instance_id}-{id}`, `validate()` returned `false`, or the handlers never call `api.show()`. |
| An attribute disappears after saving | It isn't declared in `layer.json` `attributes`. |
| Markup missing from the container | It was stripped by `wp_kses_post()`. Set `supports.rawHtml` and escape it yourself. |
| Your layer looks unstyled | The stylesheet isn't in `style` or `viewStyle`, its `file:` path doesn't point to a built `.css` file, or you enqueue it yourself somewhere it doesn't reach, such as the block editor canvas. |
| `GoDAM: … failed to mount.` / `… handler failed.` | Your `mount()` or a handler threw. The error follows in the console. |
