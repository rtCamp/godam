/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import './controls/godam-media';

/**
 * Controls that another setting can take over, flagged server-side by the widget.
 *
 * @type {string}
 */
const LOCKED_CONTROL_SELECTOR = '.elementor-control.godam-elementor-autoplay-locked, .elementor-control.godam-elementor-lightbox-locked';

/**
 * Make specific SEO fields read-only in the GoDAM Video widget.
 */
window.addEventListener( 'load', function() {
	if ( typeof elementor === 'undefined' ) {
		return;
	}

	const readonlyFields = [
		'seo_content_url',
		'seo_content_upload_date',
		'seo_content_duration',
		'seo_content_video_thumbnail_url',
	];

	const makeFieldsReadonly = function() {
		readonlyFields.forEach( function( fieldName ) {
			const fields = document.querySelectorAll(
				'[data-setting="' + fieldName + '"]',
			);
			fields.forEach( function( field ) {
				field.setAttribute( 'readonly', 'readonly' );
				field.classList.add( 'godam-readonly-field' );
			} );
		} );
	};

	// Run when panel is opened or widget is selected.
	// Elementor fires this hook with (panel, model, view) — the widget's
	// settings model is the `model` arg, view exposes the container needed
	// for $e.run() preview updates.
	window?.elementor.hooks.addAction(
		'panel/open_editor/widget/godam-video',
		function( panel, model, view ) {
			setTimeout( makeFieldsReadonly, 100 );
			hydrateWidget( model, view, panel );
		},
	);

	// Also run on popover toggle changes
	document.addEventListener( 'click', function( event ) {
		if ( event.target.closest( '.elementor-control-seo_settings_popover_toggle' ) ) {
			setTimeout( makeFieldsReadonly, 200 );
		}
	} );

	// GoDAM Audio: auto-fill the title/description from the selected attachment,
	// mirroring the Gutenberg block (which populates them on selection).
	window?.elementor.hooks.addAction(
		'panel/open_editor/widget/godam-audio',
		function( panel, model, view ) {
			hydrateAudioWidget( model, view );
		},
	);
} );

/**
 * The settings model of the currently-edited godam-video widget. Stored at
 * module scope so the single global click handler (registered once below)
 * can always reach the live model, even after the panel is reopened on a
 * different widget instance.
 */
let activeWidgetSettings = null;

/**
 * The Elementor container for the currently-edited widget. Needed to push
 * setting changes through `$e.run('document/elements/settings', …)` so the
 * canvas preview re-renders (a plain Backbone settings.set() does not).
 */
let activeWidgetContainer = null;

/**
 * Monotonic fetch token — discards stale REST responses after the user
 * swaps the underlying video before the previous request resolves.
 */
let activeFetchToken = 0;

/**
 * Attachment ID the grid was last rendered for. Used to skip the REST
 * round-trip when the user clicks a tile (which only changes `poster`,
 * not the underlying video) and we just need to repaint the selection
 * ring on the same grid.
 */
let renderedAttachmentId = null;

/**
 * Cached tiles markup for `renderedAttachmentId`. Elementor rebuilds the panel
 * control DOM on every re-render (e.g. the GoDAM Video widget's SEO auto-sync
 * calls panel.currentPageView.render() right after a video is picked), which
 * wipes the freshly-populated grid. Caching lets us restore the tiles on the
 * next render without another REST round-trip. `null` = not fetched yet;
 * `''` = fetched, no thumbnails available.
 */
let renderedTilesHtml = null;

/**
 * Re-render the thumbnail grid for the currently active widget settings.
 */
function renderThumbnailPicker() {
	const settings = activeWidgetSettings;
	if ( ! settings ) {
		return;
	}

	// Elementor re-renders the panel DOM on each open, so re-query each time.
	const container = document.querySelector( '[data-godam-thumbnail-picker]' );
	if ( ! container ) {
		return;
	}

	const grid = container.querySelector( '[data-godam-thumbnail-grid]' );
	if ( ! grid ) {
		return;
	}

	const emptyState = container.querySelector( '[data-godam-thumbnail-empty]' );

	const videoFile = settings.get( 'video-file' );
	const attachmentId = videoFile?.id;
	if ( ! attachmentId ) {
		grid.innerHTML = '';
		renderedAttachmentId = null;
		renderedTilesHtml = null;
		if ( emptyState ) {
			emptyState.hidden = true;
		}
		return;
	}

	// Same video as last render — no REST round-trip needed.
	if ( renderedAttachmentId === attachmentId ) {
		// Tiles are still in the DOM: just repaint the selection ring (e.g. the
		// user clicked a tile, changing only the poster).
		if ( grid.children.length > 0 ) {
			updateSelectionRing( settings, grid );
			return;
		}
		// The grid was wiped by a panel re-render (Elementor rebuilds the RAW_HTML
		// control DOM — notably the SEO auto-sync re-renders the panel right after
		// a video is picked). Restore the cached tiles instead of refetching.
		if ( null !== renderedTilesHtml ) {
			grid.innerHTML = renderedTilesHtml;
			if ( emptyState ) {
				emptyState.hidden = grid.children.length > 0;
			}
			updateSelectionRing( settings, grid );
			return;
		}
		// Otherwise a fetch is still in flight — fall through and (re)issue it.
	}

	const token = ++activeFetchToken;
	renderedAttachmentId = attachmentId;
	grid.innerHTML = '<span class="godam-elementor-thumbnail-picker__spinner"></span>';
	if ( emptyState ) {
		emptyState.hidden = true;
	}

	apiFetch( {
		path: '/godam/v1/media-library/get-video-thumbnail?attachment_id=' + encodeURIComponent( attachmentId ),
	} )
		.then( ( response ) => {
			if ( token !== activeFetchToken ) {
				return; // A newer fetch is in flight.
			}

			const auto = response?.data?.thumbnails || [];
			const custom = response?.data?.customThumbnails || [];
			const tiles = [
				...custom.map( ( url ) => ( { url, isCustom: true } ) ),
				...auto.map( ( url ) => ( { url, isCustom: false } ) ),
			];

			const activePoster = settings.get( 'poster' )?.url || '';

			if ( ! tiles.length ) {
				grid.innerHTML = '';
				renderedTilesHtml = ''; // Fetched: no thumbnails for this video.
				if ( emptyState ) {
					emptyState.hidden = false;
				}
				return;
			}

			grid.innerHTML = tiles
				.map( ( tile ) => {
					const isSelected = tile.url === activePoster;
					return (
						'<button type="button" class="godam-elementor-thumbnail-tile' +
						( isSelected ? ' is-selected' : '' ) +
						'" data-url="' + escapeAttr( tile.url ) + '">' +
						'<img src="' + escapeAttr( tile.url ) + '" alt="" draggable="false" />' +
						'</button>'
					);
				} )
				.join( '' );

			// Cache so a subsequent panel re-render can restore without refetching.
			renderedTilesHtml = grid.innerHTML;
		} )
		.catch( () => {
			if ( token !== activeFetchToken ) {
				return;
			}
			grid.innerHTML = '';
			if ( emptyState ) {
				emptyState.hidden = false;
			}
		} );
}

/**
 * Single global click handler — bound once on module load. Reads
 * `activeWidgetSettings` / `activeWidgetContainer` so it always updates
 * whichever widget is currently open in the panel.
 */
document.addEventListener( 'click', function( event ) {
	const tile = event.target.closest( '.godam-elementor-thumbnail-tile' );
	if ( ! tile || ! tile.closest( '[data-godam-thumbnail-grid]' ) ) {
		return;
	}
	if ( ! activeWidgetSettings ) {
		return;
	}
	event.preventDefault();
	const url = tile.getAttribute( 'data-url' );
	// `poster` is a {id, url} object (godam-media shape). An auto-generated
	// thumbnail has no attachment id, so set id to 0 — the render path only
	// reads .url for the poster.
	const nextPoster = { id: 0, url };

	// Route through $e.run so Elementor refreshes the canvas preview and
	// records the change in the history/undo stack. A bare Backbone .set()
	// updates the model but the preview node doesn't repaint.
	if ( activeWidgetContainer && window.$e?.run ) {
		window.$e.run( 'document/elements/settings', {
			container: activeWidgetContainer,
			settings: { poster: nextPoster },
		} );
	} else {
		// Fallback for older Elementor versions without the $e command bus.
		activeWidgetSettings.set( 'poster', nextPoster );
	}

	renderThumbnailPicker();
} );

/**
 * Repaint just the `is-selected` ring on existing tiles to match the
 * current `poster` URL. Used when the user clicks a tile (poster changed,
 * video did not) so we avoid a redundant REST refetch.
 *
 * @param {Object}      settings Backbone settings model.
 * @param {HTMLElement} grid     The grid container holding tile buttons.
 */
function updateSelectionRing( settings, grid ) {
	const activePoster = settings.get( 'poster' )?.url || '';
	grid.querySelectorAll( '.godam-elementor-thumbnail-tile' ).forEach( ( tile ) => {
		const isSelected = tile.getAttribute( 'data-url' ) === activePoster;
		tile.classList.toggle( 'is-selected', isSelected );
	} );
}

/**
 * Render the thumbnail picker once its container is present in the panel DOM.
 *
 * The picker is a conditional RAW_HTML control Elementor injects asynchronously
 * — and only once a video with an id is selected. So on first add (select a
 * video, which reveals the control) or a passive panel open, the container may
 * not exist yet at the moment we want to render, and renderThumbnailPicker()
 * would bail with nothing to re-trigger it (the grid then only fills after a
 * reload). Poll (bounded, ~2s) until the container appears, then render once;
 * bail if the panel has since switched to a different widget.
 */
function scheduleThumbnailPickerRender() {
	const settings = activeWidgetSettings;
	let attempts = 0;
	const attempt = () => {
		if ( activeWidgetSettings !== settings ) {
			return;
		}
		if ( document.querySelector( '[data-godam-thumbnail-picker]' ) ) {
			renderThumbnailPicker();
			return;
		}
		if ( attempts < 20 ) {
			attempts++;
			setTimeout( attempt, 100 );
		}
	};
	attempt();
}

/**
 * Wildcard `change` handler used to refresh the thumbnail grid when the
 * underlying video changes. Elementor's BaseMultiple controls (godam-media
 * included) update sub-keys via paths and emit `change:video-file.id` /
 * `change:video-file.url` — NOT `change:video-file`. Listening to the
 * generic 'change' event and inspecting `model.changed` is the only way to
 * catch both shapes reliably across Elementor versions.
 * @param {any} changedModel
 */
function onSettingsChange( changedModel ) {
	const changed = changedModel?.changed || {};
	const keys = Object.keys( changed );
	if ( keys.some( ( key ) => key === 'video-file' || key.indexOf( 'video-file' ) === 0 ) ) {
		// Selecting a video reveals the (conditional) picker control, which
		// Elementor mounts asynchronously — wait for it before rendering.
		scheduleThumbnailPickerRender();
	} else if ( keys.indexOf( 'poster' ) !== -1 ) {
		// Selection ring follows the poster, even when the user uploads via
		// the godam-media tile above the grid.
		scheduleThumbnailPickerRender();
	} else if ( keys.indexOf( 'autoplay' ) !== -1 || keys.indexOf( 'show_in_lightbox' ) !== -1 ) {
		applyControlLocks( changedModel );
	}
}

/**
 * Toggle a visual "disabled" state on controls another setting has taken over.
 *
 * Two independent locks, so each control is matched against the one that owns it
 * rather than a single flag: Autoplay locks Muted + Hover Option, and "Show in
 * lightbox" locks Hover Option (its inline render is a click-to-open poster, so
 * there is nothing left to hover). Mirrors the block, which disables these
 * controls rather than hiding them.
 *
 * @param {Object} settings Backbone settings model of the widget.
 */
function applyControlLocks( settings ) {
	const autoplayOn = 'yes' === settings?.get?.( 'autoplay' );
	const lightboxOn = 'yes' === settings?.get?.( 'show_in_lightbox' );

	document.querySelectorAll( LOCKED_CONTROL_SELECTOR ).forEach( ( el ) => {
		const locked = ( autoplayOn && el.classList.contains( 'godam-elementor-autoplay-locked' ) ) ||
			( lightboxOn && el.classList.contains( 'godam-elementor-lightbox-locked' ) );
		el.classList.toggle( 'godam-control-is-disabled', locked );
	} );
}

/**
 * Hydrate the auto-generated thumbnail grid for the GoDAM Video widget.
 *
 * Mirrors the block editor's ThumbnailPanel: fetches thumbnails from the
 * same `/godam/v1/media-library/get-video-thumbnail` REST endpoint for the
 * currently selected video and renders them as clickable tiles.
 *
 * Also wires the autoplay → disabled state for the muted / hover_select
 * controls (these stay visible but go non-interactive when autoplay is on).
 *
 * @param {Object} model Backbone model of the widget element (the `model` arg from the `panel/open_editor/widget/X` hook).
 * @param {Object} view  Editor view for the widget — used to resolve the Elementor container for $e.run() preview updates.
 * @param {Object} panel Elementor panel object (the `panel` arg from the hook), used to re-populate the picker after panel re-renders.
 */
function hydrateWidget( model, view, panel ) {
	const settings = model?.get?.( 'settings' );
	if ( ! settings ) {
		return;
	}

	// Detach listeners from the previous widget's settings before swapping
	// in the new one — otherwise we'd keep firing renders for a model whose
	// DOM is gone.
	if ( activeWidgetSettings && activeWidgetSettings !== settings ) {
		activeWidgetSettings.off( 'change', onSettingsChange );
	}

	activeWidgetSettings = settings;
	activeWidgetContainer = view?.getContainer?.() || view?.container || null;

	// Each panel open replaces the picker's DOM. Invalidate the caches so the
	// first render after hydration always rebuilds the grid (otherwise the
	// cached id would match and we'd be left with an empty grid container).
	renderedAttachmentId = null;
	renderedTilesHtml = null;

	settings.off( 'change', onSettingsChange );
	settings.on( 'change', onSettingsChange );

	// Elementor rebuilds the panel control DOM on every re-render (e.g. the SEO
	// auto-sync calls panel.currentPageView.render() right after a video is
	// picked), which wipes the freshly-populated picker grid. Re-populate on each
	// render — renderThumbnailPicker() restores cached tiles without refetching.
	if ( panel && panel.currentPageView && panel.currentPageView.on ) {
		panel.currentPageView.off( 'render', scheduleThumbnailPickerRender );
		panel.currentPageView.on( 'render', scheduleThumbnailPickerRender );
	}

	// The control locks don't depend on the picker DOM, so apply them on a short delay.
	setTimeout( () => applyControlLocks( settings ), 100 );

	// Render the picker once Elementor has mounted its (conditional) control.
	scheduleThumbnailPickerRender();
}

/**
 * Minimal HTML attribute escaper for thumbnail URLs.
 *
 * @param {string} value Raw attribute value.
 * @return {string} Escaped value safe for use inside double quotes.
 */
function escapeAttr( value ) {
	return String( value )
		.replace( /&/g, '&amp;' )
		.replace( /"/g, '&quot;' )
		.replace( /</g, '&lt;' )
		.replace( />/g, '&gt;' );
}

/* ── GoDAM Audio: auto-populate title / description ────────────────────────── */

/**
 * Settings model + container of the currently-edited godam-audio widget.
 */
let activeAudioSettings = null;
let activeAudioContainer = null;

/**
 * Monotonic token so a stale description fetch (user swapped the audio before
 * the previous request resolved) is discarded.
 */
let audioFetchToken = 0;

/**
 * Strip tags from a rendered HTML string and collapse whitespace. Used for the
 * attachment description, whose REST `rendered` form is wrapped in markup.
 *
 * @param {string} html Rendered HTML.
 * @return {string} Plain text.
 */
function stripHtml( html ) {
	const tmp = document.createElement( 'div' );
	tmp.innerHTML = String( html || '' );
	return ( tmp.textContent || tmp.innerText || '' ).replace( /\s+/g, ' ' ).trim();
}

/**
 * Re-render the given controls in the currently open panel so their inputs
 * reflect the model. Elementor text/textarea controls read the model only on
 * render and deliberately don't sync external model changes back into the input
 * (to avoid cursor jumps while typing), so a programmatic value change leaves
 * the visible field stale until we force a re-render. No-op when the panel
 * isn't showing a widget with these controls.
 *
 * @param {string[]} names Control names to refresh.
 */
function refreshPanelControls( names ) {
	try {
		const page = window.elementor?.getPanelView?.()?.getCurrentPageView?.();
		if ( ! page || ! page.children || ! page.children.each ) {
			return;
		}
		page.children.each( ( view ) => {
			const name = view?.model?.get?.( 'name' );
			if ( name && names.indexOf( name ) !== -1 && 'function' === typeof view.render ) {
				view.render();
			}
		} );
	} catch ( e ) {}
}

/**
 * Push settings onto the active audio widget so the canvas preview re-renders
 * (a bare Backbone .set() updates the model but not the preview node), then
 * refresh the matching panel inputs so the field values are visible immediately.
 *
 * @param {Object} values Map of setting keys to values.
 */
function applyAudioSettings( values ) {
	// The container ref is captured at hydrate; if Elementor rebuilt the element
	// it can go stale and $e.run() may throw. Guard it (this runs from a fetch
	// .then()/.catch(), so an unguarded throw would surface as an unhandled
	// rejection) and fall back to a direct model update.
	try {
		if ( activeAudioContainer && window.$e?.run ) {
			window.$e.run( 'document/elements/settings', {
				container: activeAudioContainer,
				settings: values,
			} );
		} else if ( activeAudioSettings ) {
			Object.keys( values ).forEach( ( key ) => activeAudioSettings.set( key, values[ key ] ) );
		}
	} catch ( e ) {
		try {
			if ( activeAudioSettings ) {
				Object.keys( values ).forEach( ( key ) => activeAudioSettings.set( key, values[ key ] ) );
			}
		} catch ( e2 ) {}
	}

	refreshPanelControls( Object.keys( values ) );
}

/**
 * Apply only the fields the user has NOT edited since `snapshot` was captured,
 * so a late REST populate never clobbers an in-progress Title / Description edit
 * (the user may select an audio and immediately start typing an override).
 *
 * @param {Object} values   Proposed setting values.
 * @param {Object} snapshot Field values captured when the populate started.
 */
function applyAudioSettingsIfUntouched( values, snapshot ) {
	const settings = activeAudioSettings;
	if ( ! settings ) {
		return;
	}
	const toApply = {};
	Object.keys( values ).forEach( ( key ) => {
		if ( settings.get( key ) === snapshot[ key ] ) {
			toApply[ key ] = values[ key ];
		}
	} );
	if ( Object.keys( toApply ).length ) {
		applyAudioSettings( toApply );
	}
}

/**
 * Fill the Audio Title + Description controls from the selected attachment.
 * Title is already carried on the godam-media control value; the description is
 * fetched from the REST API. Mirrors the block: a new selection overwrites both,
 * clearing the audio empties them — but an edit the user makes after selecting
 * is preserved (see applyAudioSettingsIfUntouched). Only runs on an audio-file
 * change, never on panel open, so existing widgets keep their saved values and
 * render.php's "leave empty → attachment title" fallback stays intact.
 */
function populateAudioMeta() {
	const settings = activeAudioSettings;
	if ( ! settings ) {
		return;
	}

	const audioFile = settings.get( 'audio-file' ) || {};
	const id = audioFile.id;

	// Snapshot current field values so a late apply only writes fields the user
	// hasn't touched since this populate started.
	const snapshot = {
		audio_title: settings.get( 'audio_title' ),
		description: settings.get( 'description' ),
	};

	// Audio removed — clear the auto-filled fields (matches the block).
	if ( ! id ) {
		applyAudioSettingsIfUntouched( { audio_title: '', description: '' }, snapshot );
		return;
	}

	const controlTitle = 'string' === typeof audioFile.title ? audioFile.title : '';
	const token = ++audioFetchToken;

	apiFetch( { path: '/wp/v2/media/' + encodeURIComponent( id ) + '?context=edit' } )
		.then( ( media ) => {
			if ( token !== audioFetchToken ) {
				return; // A newer selection is in flight.
			}
			const title = media?.title?.raw ?? media?.title?.rendered ?? controlTitle;
			const description = media?.description?.raw ?? stripHtml( media?.description?.rendered );
			applyAudioSettingsIfUntouched( {
				audio_title: title || controlTitle,
				description: ( description || '' ).trim(),
			}, snapshot );
		} )
		.catch( () => {
			if ( token !== audioFetchToken ) {
				return;
			}
			// Fall back to the title already on the control value.
			applyAudioSettingsIfUntouched( { audio_title: controlTitle }, snapshot );
		} );
}

/**
 * Change handler for the audio widget. The godam-media control emits sub-key
 * changes (`change:audio-file.id` / `.url` / `.title`), so inspect model.changed
 * and react to any `audio-file*` key.
 *
 * @param {Object} changedModel Backbone model that changed.
 */
function onAudioSettingsChange( changedModel ) {
	const changed = changedModel?.changed || {};
	const keys = Object.keys( changed );
	if ( keys.some( ( key ) => key === 'audio-file' || key.indexOf( 'audio-file' ) === 0 ) ) {
		populateAudioMeta();
	}
}

/**
 * Track the currently-edited godam-audio widget and wire the change listener.
 *
 * @param {Object} model Backbone model of the widget element.
 * @param {Object} view  Editor view (used to resolve the $e.run container).
 */
function hydrateAudioWidget( model, view ) {
	const settings = model?.get?.( 'settings' );
	if ( ! settings ) {
		return;
	}

	if ( activeAudioSettings && activeAudioSettings !== settings ) {
		activeAudioSettings.off( 'change', onAudioSettingsChange );
	}

	activeAudioSettings = settings;
	activeAudioContainer = view?.getContainer?.() || view?.container || null;

	settings.off( 'change', onAudioSettingsChange );
	settings.on( 'change', onAudioSettingsChange );
}
