/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import './controls/godam-media';

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
			hydrateWidget( model, view );
		},
	);

	// Also run on popover toggle changes
	document.addEventListener( 'click', function( event ) {
		if ( event.target.closest( '.elementor-control-seo_settings_popover_toggle' ) ) {
			setTimeout( makeFieldsReadonly, 200 );
		}
	} );
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
	const emptyState = container.querySelector( '[data-godam-thumbnail-empty]' );
	if ( ! grid ) {
		return;
	}

	const videoFile = settings.get( 'video-file' );
	const attachmentId = videoFile?.id;
	if ( ! attachmentId ) {
		grid.innerHTML = '';
		renderedAttachmentId = null;
		if ( emptyState ) {
			emptyState.hidden = true;
		}
		return;
	}

	// Same video as last render — skip the REST round-trip and just repaint
	// the selection ring on the existing tiles. Triggered when the user
	// clicks a tile (poster changed, video did not).
	if ( renderedAttachmentId === attachmentId ) {
		updateSelectionRing( settings, grid );
		return;
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
 * Wildcard `change` handler used to refresh the thumbnail grid when the
 * underlying video changes. Elementor's BaseMultiple controls (godam-media
 * included) update sub-keys via paths and emit `change:video-file.id` /
 * `change:video-file.url` — NOT `change:video-file`. Listening to the
 * generic 'change' event and inspecting `model.changed` is the only way to
 * catch both shapes reliably across Elementor versions.
 */
function onSettingsChange( changedModel ) {
	const changed = changedModel?.changed || {};
	const keys = Object.keys( changed );
	if ( keys.some( ( key ) => key === 'video-file' || key.indexOf( 'video-file' ) === 0 ) ) {
		renderThumbnailPicker();
	} else if ( keys.indexOf( 'poster' ) !== -1 ) {
		// Selection ring follows the poster, even when the user uploads via
		// the godam-media tile above the grid.
		renderThumbnailPicker();
	} else if ( keys.indexOf( 'autoplay' ) !== -1 ) {
		applyAutoplayLock( !! changed.autoplay && 'yes' === changed.autoplay );
	}
}

/**
 * Toggle a visual "disabled" state on controls flagged with the
 * `godam-elementor-autoplay-locked` class (Muted + Hover Option), mirroring
 * the block which disables them when Autoplay is on.
 *
 * @param {boolean} locked Whether autoplay is currently on.
 */
function applyAutoplayLock( locked ) {
	document.querySelectorAll( '.elementor-control.godam-elementor-autoplay-locked' ).forEach( ( el ) => {
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
 * @param {Object} model Backbone model of the widget element (the `model`
 *                       arg from the `panel/open_editor/widget/X` hook).
 * @param {Object} view  Editor view for the widget — used to resolve the
 *                       Elementor container for $e.run() preview updates.
 */
function hydrateWidget( model, view ) {
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

	// Each panel open replaces the picker's DOM. Invalidate the
	// "same attachment, skip refetch" cache so the first render after
	// hydration always rebuilds the grid (otherwise the cached id would
	// match and we'd be left with an empty grid container).
	renderedAttachmentId = null;

	settings.off( 'change', onSettingsChange );
	settings.on( 'change', onSettingsChange );

	// Initial render + autoplay-lock application once Elementor finishes
	// injecting the control DOM for this panel open.
	setTimeout( () => {
		renderThumbnailPicker();
		applyAutoplayLock( 'yes' === settings.get( 'autoplay' ) );
	}, 100 );
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
