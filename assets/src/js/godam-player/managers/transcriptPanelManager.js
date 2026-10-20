/**
 * External dependencies
 */
import videojs from 'video.js';

/**
 * WordPress dependencies
 */
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { isPlayerFullscreen, setupFullscreenReparenting } from '../utils/fullscreenReparent.js';
import { computeTranscriptLayout, findMatchRanges, normaliseQuery } from '../utils/transcriptPanelLayout.js';
import { toWebVttTrackSrc } from '../utils/captionTrackSrc.js';

// Minimum container width (px) at which the Bubble skin routes the button into
// the control bar instead of overlaying it — matches ShareManager.
const MIN_BUBBLE_WIDTH = 480;

// WordPress "copy" icon (matches @wordpress/icons `copy`).
const COPY_ICON_SVG = `<svg class="godam-transcript-panel__copy-icon" viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path fill-rule="evenodd" clip-rule="evenodd" d="M5 4.5h11a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5ZM3 5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Zm17 3v10.75c0 .69-.56 1.25-1.25 1.25H6v1.5h12.75a2.75 2.75 0 0 0 2.75-2.75V8H20Z" fill="currentColor"/></svg>`;

// WordPress "check" icon, shown briefly after a successful copy.
const CHECK_ICON_SVG = `<svg class="godam-transcript-panel__copy-icon" viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M16.7 7.1l-6.3 8.5-3.3-2.5-.9 1.2 4.5 3.4L17.9 8z" fill="currentColor"/></svg>`;

// WordPress "close" icon (matches @wordpress/icons `close`).
const CLOSE_ICON_SVG = `<svg class="godam-transcript-panel__close-icon" viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="m13.06 12 6.47-6.47-1.06-1.06L12 10.94 5.53 4.47 4.47 5.53 10.94 12l-6.47 6.47 1.06 1.06L12 13.06l6.47 6.47 1.06-1.06L13.06 12Z" fill="currentColor"/></svg>`;

// WordPress "search" icon (matches @wordpress/icons `search`).
const SEARCH_ICON_SVG = `<svg class="godam-transcript-panel__search-icon" viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M13 5c-3.3 0-6 2.7-6 6 0 1.4.5 2.7 1.3 3.7l-3.8 3.8 1.1 1.1 3.8-3.8c1 .8 2.3 1.3 3.7 1.3 3.3 0 6-2.7 6-6S16.3 5 13 5zm0 10.5c-2.5 0-4.5-2-4.5-4.5s2-4.5 4.5-4.5 4.5 2 4.5 4.5-2 4.5-4.5 4.5z" fill="currentColor"/></svg>`;

// Transcript button icon (a document with text lines).
const TRANSCRIPT_ICON_SVG = `<svg class="godam-transcript-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
		<path d="M5 3.5h14a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5Z" stroke="currentColor" stroke-width="1.6"/>
		<path d="M7 8h10M7 12h10M7 16h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
	</svg>`;

// CSS class names.
const BUTTON_CLASS = 'godam-transcript-button';
const PANEL_CLASS = 'godam-transcript-panel';
const CUE_CLASS = 'godam-transcript-cue';
// Added to the video wrapper while the panel is open.
const OPEN_CLASS = 'godam-transcript-open';
// Added to the wrapper while a panel is present (a plain class instead of
// `:has()`, which some browsers lack).
const HAS_PANEL_CLASS = 'godam-has-transcript-panel';
// How the open panel shares space with the video (see computeTranscriptLayout).
const LAYOUT_SIDE_CLASS = 'godam-transcript-layout--side';
const LAYOUT_BELOW_CLASS = 'godam-transcript-layout--below';
// Added to the block root while it is widened to fit the panel beside the video.
const EXPANDED_CLASS = 'godam-transcript-expanded';
const ACTIVE_CUE_CLASS = 'godam-transcript-cue--active';
const HIDDEN_CUE_CLASS = 'godam-transcript-cue--hidden';

// CSS custom properties the layout writes on the wrapper.
const LAYOUT_VARS = [
	'--godam-transcript-panel-width',
	'--godam-transcript-panel-height',
	'--godam-transcript-stage-height',
	'--godam-transcript-player-width',
	'--godam-transcript-player-height',
	'--godam-transcript-player-top',
];

// Inline styles the layout overrides on the block root while it is widened.
const ROOT_STYLE_PROPS = [ 'width', 'max-width', 'aspect-ratio' ];

// Copy feedback duration in ms.
const COPY_FEEDBACK_DELAY = 2000;

/**
 * Transcript Panel Manager
 *
 * Adds an on-video transcript toggle button (top-right corner, just before the
 * share button) that opens a side panel listing the video's transcription as
 * timestamped, clickable cues. Clicking a cue seeks the player; the cue under
 * the playhead is highlighted as the video plays, and a search field narrows
 * the list to matching cues.
 *
 * The open panel never covers the video: it takes its own space beside the
 * video (or beneath it when there is no room), see `applyLayout()`.
 *
 * The transcript text is resolved the same way TranscriptManager resolves it —
 * the attachment's stored transcript first, the public API by job id as a
 * fallback — then the cues are loaded through a hidden Video.js
 * `metadata` text track so the browser handles all WebVTT parsing (and so the
 * VTT is fetched by the media element, sidestepping cross-origin fetch issues).
 * An uploaded .srt is converted to WebVTT first (see captionTrackSrc.js).
 *
 * @class TranscriptPanelManager
 * @param {Object}      player            Video.js player instance.
 * @param {HTMLElement} video             The target <video> element.
 * @param {Object}      videoSetupOptions Player setup options (`showTranscription`, `showShareBtn`).
 */
export default class TranscriptPanelManager {
	constructor( player, video, videoSetupOptions = {} ) {
		this.player = player;
		this.video = video;
		this.videoSetupOptions = videoSetupOptions;
		this.jobId = video.dataset.job_id || '';
		// Transcript cached on the attachment and printed by the server.
		this.localTranscriptUrl = video.dataset.transcriptUrl || '';
		this.transcriptDeleted = video.dataset.transcriptDeleted === 'true';
		this.Button = videojs.getComponent( 'Button' );

		this.container = null;
		this.wrapper = null;
		this.button = null;
		this.buttonInControlBar = false;
		this.panel = null;
		this.bodyEl = null;
		this.searchInput = null;
		this.searchStatus = null;
		this.cues = [];
		this.cueElements = [];
		this.cueTextElements = [];
		this.activeCueIndex = -1;
		this.copyResetTimeout = null;
		this.isOpen = false;

		// Layout state while the panel is open.
		this.root = null;
		this.rootStyleBackup = null;
		this.lightboxWrapper = null;
		this.lightboxRatioBackup = null;
		this.layoutSignature = '';
		this.resizeObserver = null;
		this.lightboxObserver = null;
		this.observedParent = null;
		this.reducedMotion = window.matchMedia?.( '(prefers-reduced-motion: reduce)' ) || null;

		this.handleTimeUpdate = this.handleTimeUpdate.bind( this );
		this.applyLayout = this.applyLayout.bind( this );

		this.init();
	}

	/**
	 * Decide whether the panel should be built, then wire it up.
	 */
	init() {
		// Default to enabled; only an explicit `false` (or the disabled context)
		// turns the panel off.
		if ( this.videoSetupOptions?.showTranscription === false ) {
			return;
		}

		if ( this.video.dataset.disableTranscript === 'true' ) {
			return;
		}

		// Nothing to show: deleted in the editor, or no stored transcript and no
		// job id to look one up with.
		if ( this.transcriptDeleted || ( ! this.jobId && ! this.localTranscriptUrl ) ) {
			return;
		}

		this.container = this.player.el().closest( '.easydam-video-container' );
		if ( ! this.container ) {
			return;
		}
		// The panel lives in the wrapper, next to the video container; the
		// wrapper is also the element that carries the open/layout state.
		this.wrapper = this.container.closest( '.godam-video-wrapper' ) || this.container.parentElement;

		// Resolve the transcript and only render the UI once we know cues exist.
		this.loadCues().catch( () => {
			// Transcript is optional — fail silently.
		} );
	}

	/**
	 * Get the API base URL from global settings.
	 *
	 * @return {string} The API base URL.
	 */
	getApiBase() {
		return window?.godamSettings?.apiBase || 'https://app.godam.io';
	}

	/**
	 * Resolve the transcript VTT URL for this video's job id.
	 *
	 * @return {Promise<string|null>} The VTT URL, or null when none exists.
	 */
	async resolveTranscriptUrl() {
		// The transcript stored on the attachment (generated or uploaded in the
		// media editor's Transcription tab) takes precedence.
		if ( this.localTranscriptUrl ) {
			return this.localTranscriptUrl;
		}

		const endpoint = `${ this.getApiBase() }/api/method/godam_core.api.process.get_public_transcription_path`;
		const url = `${ endpoint }?job_name=${ encodeURIComponent( this.jobId ) }`;

		const response = await fetch( url, {
			method: 'GET',
			headers: { Accept: 'application/json' },
		} );

		if ( ! response.ok ) {
			throw new Error( `HTTP ${ response.status }` );
		}

		const data = await response.json();
		// Unwrap Frappe-style `{ message: { ... } }` responses.
		const payload = data?.message !== undefined ? data.message : data;

		return payload?.exists && payload?.url ? payload.url : null;
	}

	/**
	 * Load the transcript cues via a hidden metadata text track, then render.
	 *
	 * @return {Promise<void>}
	 */
	async loadCues() {
		const transcriptUrl = await this.resolveTranscriptUrl();
		if ( ! transcriptUrl ) {
			return;
		}
		// The media editor accepts .srt too; a track only parses WebVTT.
		const trackSrc = await toWebVttTrackSrc( transcriptUrl );

		// `metadata` keeps the track out of the subtitles/captions menu; `hidden`
		// mode forces the browser to download and parse the cues without
		// rendering them on screen.
		const trackEl = this.player.addRemoteTextTrack(
			{
				kind: 'metadata',
				label: 'GoDAM Transcript',
				srclang: 'en',
				src: trackSrc,
			},
			false,
		);

		const track = trackEl?.track || trackEl;
		if ( ! track ) {
			return;
		}
		track.mode = 'hidden';

		const onCuesReady = () => {
			if ( this.button ) {
				return; // Already rendered.
			}

			const cues = Array.from( track.cues || [] );
			if ( cues.length === 0 ) {
				return;
			}

			this.cues = cues
				.map( ( cue ) => ( {
					start: cue.startTime,
					end: cue.endTime,
					// One line of text, as it renders, so a search can match across
					// the cue's line breaks.
					text: ( cue.text || '' ).replace( /[<>]/g, '' ).replace( /\s+/g, ' ' ).trim(),
				} ) )
				.filter( ( cue ) => cue.text !== '' );

			if ( this.cues.length > 0 ) {
				this.render();
			}
		};

		// Cues may already be present; otherwise wait for the track's load event.
		// The `load` event is unreliable across browsers for remote text tracks,
		// so also poll briefly as a fallback until the cues parse.
		onCuesReady();
		trackEl.addEventListener?.( 'load', onCuesReady );
		track.addEventListener?.( 'load', onCuesReady );

		let attempts = 0;
		const poll = setInterval( () => {
			attempts += 1;
			onCuesReady();
			if ( this.button || attempts >= 20 ) {
				clearInterval( poll );
			}
		}, 250 );
	}

	/**
	 * Format seconds as a clock string (`m:ss`, or `h:mm:ss` past an hour).
	 *
	 * @param {number} seconds Seconds.
	 * @return {string} Clock string.
	 */
	formatClock( seconds ) {
		const total = Math.max( 0, Math.floor( seconds || 0 ) );
		const hrs = Math.floor( total / 3600 );
		const mins = Math.floor( ( total % 3600 ) / 60 );
		const secs = total % 60;
		const pad = ( value ) => String( value ).padStart( 2, '0' );

		if ( hrs > 0 ) {
			return `${ hrs }:${ pad( mins ) }:${ pad( secs ) }`;
		}
		return `${ mins }:${ pad( secs ) }`;
	}

	/**
	 * Build and attach the toggle button and panel, and wire up events.
	 */
	render() {
		this.registerButtonComponent();
		this.addToggleButton();
		this.createPanel();
		this.setupFullscreenReparenting();
		this.player.on( 'timeupdate', this.handleTimeUpdate );
		// Fullscreen lays the panel out with CSS alone; entering it drops the
		// inline layout and leaving it measures the page again.
		this.player.on( 'fullscreenchange', this.applyLayout );
		this.player.on( 'customfullscreenchange', this.applyLayout );
		this.player.one( 'dispose', () => this.destroy() );
	}

	/**
	 * Register the `GodamTranscriptButton` Video.js component once.
	 *
	 * Implemented as a custom Video.js Button (mirroring `GodamShareButton`) so
	 * it shares the share button's markup, classes, and control-bar behaviour.
	 */
	registerButtonComponent() {
		if ( videojs.getComponent( 'GodamTranscriptButton' ) ) {
			return;
		}

		// The component is registered once and shared by every player on the
		// page, so it must NOT close over a single manager instance. Each
		// button resolves the manager from its own player (`this.player_`),
		// which is why each block's toggle controls only its own panel.
		class GodamTranscriptButton extends this.Button {
			buildCSSClass() {
				// The transcript button sits at the top of the stack; the
				// share button drops below it (via `.godam-has-transcript`).
				return `${ BUTTON_CLASS } ${ super.buildCSSClass() }`;
			}

			createEl() {
				const element = super.createEl();
				element.setAttribute( 'aria-label', __( 'Toggle transcript', 'godam' ) );
				element.setAttribute( 'aria-expanded', 'false' );
				element.setAttribute( 'title', __( 'Transcript', 'godam' ) );
				element.setAttribute( 'data-test-id', 'godam-video-transcript-button' );
				element.insertAdjacentHTML( 'beforeend', TRANSCRIPT_ICON_SVG );
				return element;
			}

			handleClick( event ) {
				event.preventDefault();
				this.player_?.transcriptPanelManager?.toggle();
			}
		}

		videojs.registerComponent( 'GodamTranscriptButton', GodamTranscriptButton );
	}

	/**
	 * Add the transcript button to the player, mirroring `ShareManager`: routed
	 * into the control bar on the Bubble skin (wide enough), otherwise appended
	 * to the video container as an overlay button.
	 */
	addToggleButton() {
		// Marks that a transcript button is present so the share button (when
		// shown) can drop below it in the top-right stack.
		this.container.classList.add( 'godam-has-transcript' );

		if ( this.shouldAddToControlBar() ) {
			const child = this.player.controlBar.addChild( 'GodamTranscriptButton', {} );
			this.button = child.el();
			this.buttonInControlBar = true;
			return;
		}

		const ButtonComponent = videojs.getComponent( 'GodamTranscriptButton' );
		const instance = new ButtonComponent( this.player );
		const element = instance.createEl();
		element.addEventListener( 'click', instance.handleClick.bind( instance ) );
		this.container.appendChild( element );
		this.button = element;
		this.buttonInControlBar = false;
	}

	/**
	 * Whether the button should live in the control bar (Bubble skin, wide
	 * container) rather than overlaying the video — matches `ShareManager`.
	 *
	 * @return {boolean} True when it should be added to the control bar.
	 */
	shouldAddToControlBar() {
		return (
			this.videoSetupOptions?.playerSkin === 'Bubble' &&
			this.container.offsetWidth > MIN_BUBBLE_WIDTH
		);
	}

	/**
	 * Build the transcript side panel and populate it with cues.
	 */
	createPanel() {
		const panel = document.createElement( 'div' );
		// The panel is a sibling of the skinned container, so it carries the
		// skin itself; its palette comes from per-skin tokens in the CSS.
		const skin = String( this.videoSetupOptions?.playerSkin || 'Default' ).toLowerCase();
		panel.className = `${ PANEL_CLASS } ${ PANEL_CLASS }--${ skin }`;
		panel.setAttribute( 'data-test-id', 'godam-video-transcript-panel' );
		panel.setAttribute( 'role', 'region' );
		panel.setAttribute( 'aria-label', __( 'Transcript', 'godam' ) );

		const header = document.createElement( 'div' );
		header.className = `${ PANEL_CLASS }__header`;

		const title = document.createElement( 'span' );
		title.className = `${ PANEL_CLASS }__title`;
		title.textContent = __( 'Transcript', 'godam' );

		const actions = document.createElement( 'div' );
		actions.className = `${ PANEL_CLASS }__actions`;

		const copyButton = document.createElement( 'button' );
		copyButton.type = 'button';
		copyButton.className = `${ PANEL_CLASS }__copy`;
		copyButton.setAttribute( 'aria-label', __( 'Copy transcript', 'godam' ) );
		copyButton.setAttribute( 'data-test-id', 'godam-video-transcript-copy' );
		copyButton.title = __( 'Copy transcript', 'godam' );
		copyButton.innerHTML = COPY_ICON_SVG;
		copyButton.addEventListener( 'click', () => this.copyTranscript( copyButton ) );

		const closeButton = document.createElement( 'button' );
		closeButton.type = 'button';
		closeButton.className = `${ PANEL_CLASS }__close`;
		closeButton.setAttribute( 'aria-label', __( 'Close transcript', 'godam' ) );
		closeButton.setAttribute( 'data-test-id', 'godam-video-transcript-close' );
		closeButton.title = __( 'Close transcript', 'godam' );
		closeButton.innerHTML = CLOSE_ICON_SVG;
		closeButton.addEventListener( 'click', () => this.close() );

		actions.appendChild( copyButton );
		actions.appendChild( closeButton );
		header.appendChild( title );
		header.appendChild( actions );

		const search = this.createSearchField();

		const body = document.createElement( 'div' );
		body.className = `${ PANEL_CLASS }__body`;

		this.cueTextElements = [];
		this.cueElements = this.cues.map( ( cue, index ) => {
			const row = document.createElement( 'button' );
			row.type = 'button';
			row.className = CUE_CLASS;
			row.dataset.start = String( cue.start );
			row.setAttribute( 'data-test-id', `godam-video-transcript-cue-${ index }` );

			const time = document.createElement( 'span' );
			time.className = `${ CUE_CLASS }__time`;
			time.textContent = this.formatClock( cue.start );

			const text = document.createElement( 'span' );
			text.className = `${ CUE_CLASS }__text`;
			text.textContent = cue.text;
			this.cueTextElements.push( text );

			row.appendChild( time );
			row.appendChild( text );
			row.addEventListener( 'click', () => this.seekToCue( index ) );

			body.appendChild( row );
			return row;
		} );

		panel.appendChild( header );
		panel.appendChild( search );
		panel.appendChild( body );

		// Append inside the wrapper, after the video container. It stays hidden
		// (and out of the tab order, which the lightbox's focus trap reads) until
		// opened; `applyLayout()` then gives it its own space.
		panel.hidden = true;
		panel.inert = true;
		this.wrapper.appendChild( panel );
		this.wrapper.classList.add( HAS_PANEL_CLASS );
		this.panel = panel;
		this.bodyEl = body;
	}

	/**
	 * Build the search field that narrows the cue list.
	 *
	 * @return {HTMLElement} The search row (label, input and result count).
	 */
	createSearchField() {
		const field = document.createElement( 'div' );
		field.className = `${ PANEL_CLASS }__search`;

		const label = document.createElement( 'label' );
		label.className = `${ PANEL_CLASS }__search-field`;
		label.insertAdjacentHTML( 'afterbegin', SEARCH_ICON_SVG );

		const input = document.createElement( 'input' );
		input.type = 'search';
		input.className = `${ PANEL_CLASS }__search-input`;
		input.placeholder = __( 'Search transcript', 'godam' );
		input.setAttribute( 'aria-label', __( 'Search transcript', 'godam' ) );
		input.setAttribute( 'data-test-id', 'godam-video-transcript-search' );
		input.autocomplete = 'off';
		input.spellcheck = false;
		input.addEventListener( 'input', () => this.filterCues( input.value ) );
		input.addEventListener( 'keydown', ( event ) => {
			// Escape clears a query first; only an empty field lets it through
			// (so the lightbox can still close on a second press).
			if ( event.key === 'Escape' && input.value !== '' ) {
				event.preventDefault();
				event.stopPropagation();
				input.value = '';
				this.filterCues( '' );
			}
		} );

		const status = document.createElement( 'span' );
		status.className = `${ PANEL_CLASS }__search-status`;
		status.setAttribute( 'role', 'status' );
		status.setAttribute( 'aria-live', 'polite' );
		status.setAttribute( 'data-test-id', 'godam-video-transcript-search-status' );

		label.appendChild( input );
		field.appendChild( label );
		field.appendChild( status );

		this.searchInput = input;
		this.searchStatus = status;
		return field;
	}

	/**
	 * Show only the cues that contain the query, with each match highlighted.
	 * An empty query restores the full list. Results keep click-to-seek.
	 *
	 * @param {string} rawQuery The text typed in the search field.
	 */
	filterCues( rawQuery ) {
		const query = normaliseQuery( rawQuery );
		let matches = 0;

		this.cues.forEach( ( cue, index ) => {
			const row = this.cueElements[ index ];
			const textEl = this.cueTextElements[ index ];
			if ( ! row || ! textEl ) {
				return;
			}

			const ranges = findMatchRanges( cue.text, query );
			const visible = ! query || ranges.length > 0;
			row.classList.toggle( HIDDEN_CUE_CLASS, ! visible );
			row.hidden = ! visible;
			if ( visible && query ) {
				matches += 1;
			}
			this.renderCueText( textEl, cue.text, ranges );
		} );

		if ( ! this.searchStatus ) {
			return;
		}

		if ( ! query ) {
			this.searchStatus.textContent = '';
		} else if ( matches === 0 ) {
			this.searchStatus.textContent = __( 'No matches', 'godam' );
		} else {
			/* translators: %d: number of transcript lines that match the search. */
			this.searchStatus.textContent = sprintf( _n( '%d match', '%d matches', matches, 'godam' ), matches );
		}
	}

	/**
	 * Write a cue's text, wrapping each matched range in `<mark>`. Built from
	 * text nodes, never HTML, since the text comes from the caption file.
	 *
	 * @param {HTMLElement}             textEl The cue's text element.
	 * @param {string}                  text   The cue text.
	 * @param {Array<[number, number]>} ranges Matched `[start, end)` ranges.
	 */
	renderCueText( textEl, text, ranges ) {
		if ( ranges.length === 0 ) {
			if ( textEl.childElementCount > 0 || textEl.textContent !== text ) {
				textEl.textContent = text;
			}
			return;
		}

		const fragment = document.createDocumentFragment();
		let cursor = 0;
		ranges.forEach( ( [ start, end ] ) => {
			if ( start > cursor ) {
				fragment.appendChild( document.createTextNode( text.slice( cursor, start ) ) );
			}
			const mark = document.createElement( 'mark' );
			mark.className = `${ CUE_CLASS }__match`;
			mark.textContent = text.slice( start, end );
			fragment.appendChild( mark );
			cursor = end;
		} );
		if ( cursor < text.length ) {
			fragment.appendChild( document.createTextNode( text.slice( cursor ) ) );
		}

		textEl.replaceChildren( fragment );
	}

	/**
	 * Keep the button and panel visible in fullscreen.
	 *
	 * Video.js requests fullscreen on the player element (`.video-js`), and only
	 * that element's subtree renders in the fullscreen top layer. The overlay
	 * button lives in `.easydam-video-container` and the panel in the wrapper —
	 * both ancestors of `.video-js` — so they vanish in fullscreen unless moved
	 * inside it. Reparent on enter and restore on exit (the same approach the
	 * layer managers use). Listens to the native `fullscreenchange` and the
	 * iOS custom `customfullscreenchange` events; the `.vjs-fullscreen` class on
	 * the player element is set for both.
	 */
	setupFullscreenReparenting() {
		// The panel restores into the wrapper; the overlay button into the
		// container. The control-bar button (Bubble skin) is already inside
		// `.video-js`, so it is skipped by returning null from its getter.
		setupFullscreenReparenting( {
			player: this.player,
			getElement: () => this.panel,
			getRestoreParent: () => this.wrapper,
		} );
		setupFullscreenReparenting( {
			player: this.player,
			getElement: () => ( this.buttonInControlBar ? null : this.button ),
			getRestoreParent: () => this.container,
		} );
	}

	/**
	 * Toggle the panel open/closed.
	 */
	toggle() {
		if ( this.isOpen ) {
			this.close();
		} else {
			this.open();
		}
	}

	/**
	 * Open the transcript panel.
	 */
	open() {
		if ( ! this.panel ) {
			return;
		}
		this.isOpen = true;
		this.panel.hidden = false;
		this.panel.inert = false;
		this.wrapper.classList.add( OPEN_CLASS );
		this.button?.setAttribute( 'aria-expanded', 'true' );
		this.button?.classList.add( `${ BUTTON_CLASS }--active` );
		this.applyLayout();
		this.observeLayout();
		// Sync the active-cue highlight to the current playhead.
		this.handleTimeUpdate();
	}

	/**
	 * Close the transcript panel.
	 */
	close() {
		if ( ! this.panel ) {
			return;
		}
		const hadFocus = this.panel.contains( this.panel.ownerDocument.activeElement );
		this.isOpen = false;
		this.unobserveLayout();
		this.clearLayout();
		this.wrapper.classList.remove( OPEN_CLASS );
		this.panel.hidden = true;
		this.panel.inert = true;
		this.button?.setAttribute( 'aria-expanded', 'false' );
		this.button?.classList.remove( `${ BUTTON_CLASS }--active` );
		// Closing from inside the panel would drop focus to the page (behind the
		// lightbox, if open). Hand it to the toggle, or the player if the toggle
		// cannot take it (it is hidden until hovered).
		if ( hadFocus ) {
			this.button?.focus?.( { preventScroll: true } );
			if ( this.panel.ownerDocument.activeElement !== this.button ) {
				this.player.el()?.focus?.( { preventScroll: true } );
			}
		}
		this.notifyPlayerResize();
	}

	/**
	 * The block root: the element that carries the block's width (and, from
	 * Player Height, its inline max-width). Markup is root > figure > wrapper.
	 *
	 * @return {HTMLElement|null} The root, or null when the markup differs.
	 */
	getRoot() {
		const figure = this.wrapper?.parentElement;
		return figure?.tagName === 'FIGURE' ? figure.parentElement : null;
	}

	/**
	 * Measure the closed-state geometry the layout is computed from. Call with
	 * the layout cleared, so the stage reports its natural size.
	 *
	 * @return {Object} `{ stageWidth, stageHeight, ratio, room, maxHeight }` in px.
	 */
	measureLayout() {
		const stageWidth = this.container.offsetWidth;
		const stageHeight = this.container.offsetHeight;
		const playerEl = this.player.el();
		const ratio = playerEl?.offsetWidth && playerEl?.offsetHeight
			? playerEl.offsetWidth / playerEl.offsetHeight
			: 16 / 9;

		// Room the stage can widen into: the column the block sits in, less
		// whatever the root wraps around the stage (padding, borders). None in a
		// flex or grid parent (a Row or Grid group): there the root is an item
		// that would be squeezed by its siblings rather than widened, so the
		// panel stacks beneath the video instead.
		let room = stageWidth;
		const root = this.getRoot();
		const column = root?.parentElement;
		const style = column ? window.getComputedStyle( column ) : null;
		if ( column && ! /^(inline-)?(flex|grid)$/.test( style.display ) ) {
			const columnWidth = column.clientWidth -
				( parseFloat( style.paddingLeft ) || 0 ) -
				( parseFloat( style.paddingRight ) || 0 );
			room = Math.max( stageWidth, columnWidth - ( root.offsetWidth - stageWidth ) );
		}

		// The lightbox cannot scroll, so there the stage plus a panel beneath it
		// must fit its height cap.
		let maxHeight = 0;
		const lightbox = root?.closest( '.godam-player-modal-wrapper' );
		if ( lightbox ) {
			maxHeight = parseFloat( window.getComputedStyle( lightbox ).maxHeight ) || 0;
		}

		return { stageWidth, stageHeight, ratio, room, maxHeight };
	}

	/**
	 * Give the open panel its own space so it never covers the video.
	 *
	 * Inline and in the lightbox, the stage either keeps its height with the
	 * panel beside the video, or stacks the panel beneath it; see
	 * computeTranscriptLayout(). Fullscreen is laid out by CSS alone.
	 */
	applyLayout() {
		if ( ! this.isOpen || ! this.panel ) {
			return;
		}

		this.clearLayout();

		if ( isPlayerFullscreen( this.player ) ) {
			this.setLayoutSignature( 'fullscreen' );
			return;
		}

		const geometry = this.measureLayout();
		const layout = computeTranscriptLayout( geometry );
		const px = ( value ) => `${ Math.round( value ) }px`;

		if ( layout.mode === 'below' ) {
			this.wrapper.classList.add( LAYOUT_BELOW_CLASS );
			this.wrapper.style.setProperty( '--godam-transcript-panel-height', px( layout.panelHeight ) );
			// Narrowed (in the lightbox) so the video and the panel both fit.
			if ( layout.width < geometry.stageWidth - 1 ) {
				const stageHeight = layout.width / geometry.ratio;
				this.resizeRoot( layout.width - geometry.stageWidth, layout.width / ( stageHeight + layout.panelHeight ) );
			}
			this.setLayoutSignature( `below:${ Math.round( layout.width ) }x${ Math.round( layout.panelHeight ) }` );
			return;
		}

		this.wrapper.classList.add( LAYOUT_SIDE_CLASS );
		this.wrapper.style.setProperty( '--godam-transcript-panel-width', px( layout.panelWidth ) );
		this.wrapper.style.setProperty( '--godam-transcript-stage-height', px( layout.stageHeight ) );
		this.wrapper.style.setProperty( '--godam-transcript-player-width', px( layout.playerWidth ) );
		this.wrapper.style.setProperty( '--godam-transcript-player-height', px( layout.playerHeight ) );
		this.wrapper.style.setProperty( '--godam-transcript-player-top', px( layout.playerTop ) );

		if ( layout.expandBy >= 1 ) {
			this.resizeRoot( layout.expandBy, layout.width / layout.stageHeight );
		}

		this.setLayoutSignature( `side:${ Math.round( layout.width ) }x${ Math.round( layout.playerWidth ) }` );
	}

	/**
	 * Remove everything `applyLayout()` set, back to the closed geometry.
	 */
	clearLayout() {
		if ( ! this.wrapper ) {
			return;
		}
		this.wrapper.classList.remove( LAYOUT_SIDE_CLASS, LAYOUT_BELOW_CLASS );
		LAYOUT_VARS.forEach( ( name ) => this.wrapper.style.removeProperty( name ) );
		this.restoreRoot();
	}

	/**
	 * Resize the block root: wider so the panel fits beside a full-size video
	 * (a portrait video grows toward 16:9), or narrower so a video and the
	 * panel beneath it fit the lightbox. Its inline styles are saved first and
	 * put back exactly by `restoreRoot()`.
	 *
	 * @param {number} expandBy   Width to add, in px (negative to narrow).
	 * @param {number} stageRatio Width / height of the resized content.
	 */
	resizeRoot( expandBy, stageRatio ) {
		const root = this.getRoot();
		if ( ! root ) {
			return;
		}

		const width = root.offsetWidth + expandBy;
		this.root = root;
		this.rootStyleBackup = ROOT_STYLE_PROPS.map( ( prop ) => [
			prop,
			root.style.getPropertyValue( prop ),
			root.style.getPropertyPriority( prop ),
		] );
		// `important` so this also beats the lightbox's own `!important` sizing.
		root.style.setProperty( 'width', `${ Math.round( width ) }px`, 'important' );
		root.style.setProperty( 'max-width', 'none', 'important' );
		root.style.setProperty( 'aspect-ratio', 'auto', 'important' );
		root.classList.add( EXPANDED_CLASS );

		// In the lightbox, the close button finds the video's corner from this
		// ratio; point it at the resized content while the panel is open.
		const lightbox = root.closest( '.godam-player-modal-wrapper' );
		if ( lightbox ) {
			this.lightboxWrapper = lightbox;
			this.lightboxRatioBackup = lightbox.style.getPropertyValue( '--godam-lightbox-ratio' );
			lightbox.style.setProperty( '--godam-lightbox-ratio', String( stageRatio ) );
		}
	}

	/**
	 * Undo `resizeRoot()`.
	 */
	restoreRoot() {
		if ( this.root && this.rootStyleBackup ) {
			this.rootStyleBackup.forEach( ( [ prop, value, priority ] ) => {
				if ( value ) {
					this.root.style.setProperty( prop, value, priority );
				} else {
					this.root.style.removeProperty( prop );
				}
			} );
			this.root.classList.remove( EXPANDED_CLASS );
		}

		if ( this.lightboxWrapper ) {
			if ( this.lightboxRatioBackup ) {
				this.lightboxWrapper.style.setProperty( '--godam-lightbox-ratio', this.lightboxRatioBackup );
			} else {
				this.lightboxWrapper.style.removeProperty( '--godam-lightbox-ratio' );
			}
		}

		this.root = null;
		this.rootStyleBackup = null;
		this.lightboxWrapper = null;
		this.lightboxRatioBackup = null;
	}

	/**
	 * Record the layout just applied, and tell the player when it changed.
	 *
	 * @param {string} signature Short description of the layout.
	 */
	setLayoutSignature( signature ) {
		if ( signature === this.layoutSignature ) {
			return;
		}
		this.layoutSignature = signature;
		this.notifyPlayerResize();
	}

	/**
	 * Let the player's resize handlers (hotspot positions, the narrow-player
	 * control layout) re-measure after the player changed size. Video.js has
	 * no event for an element-size change, so this reuses `resize`, which those
	 * handlers already listen to.
	 */
	notifyPlayerResize() {
		window.requestAnimationFrame?.( () => this.player?.trigger?.( 'resize' ) );
	}

	/**
	 * Re-run the layout while open when the column or the block changes size
	 * (window resize, the player moving into or out of the lightbox).
	 */
	observeLayout() {
		this.watchLightboxClose();

		if ( typeof window.ResizeObserver !== 'function' ) {
			window.addEventListener( 'resize', this.applyLayout );
			return;
		}

		if ( ! this.resizeObserver ) {
			this.resizeObserver = new window.ResizeObserver( () => {
				// The lightbox moves the block to another parent; follow it.
				const column = this.getRoot()?.parentElement || null;
				if ( column && column !== this.observedParent ) {
					this.observeTargets();
				}
				this.applyLayout();
			} );
		}
		this.observeTargets();
	}

	/**
	 * Point the resize observer at the block root and its column (or, with
	 * unexpected markup, the wrapper's parent).
	 */
	observeTargets() {
		const root = this.getRoot();
		this.resizeObserver.disconnect();
		this.observedParent = root?.parentElement || this.wrapper.parentElement || null;
		[ root, this.observedParent ].filter( Boolean ).forEach( ( el ) => this.resizeObserver.observe( el ) );
	}

	/**
	 * Close the panel when the lightbox it was opened in closes. The player
	 * goes back to being a click-to-open poster, which hides the panel and its
	 * button, so the layout would otherwise stay applied to the poster. The
	 * lightbox marks its wrapper with `godam-lightbox-open` while it is up.
	 */
	watchLightboxClose() {
		if ( ! this.wrapper.classList.contains( 'godam-show-in-lightbox' ) || typeof window.MutationObserver !== 'function' ) {
			return;
		}
		if ( ! this.lightboxObserver ) {
			this.lightboxObserver = new window.MutationObserver( () => {
				if ( this.isOpen && ! this.wrapper.classList.contains( 'godam-lightbox-open' ) ) {
					this.close();
				}
			} );
		}
		this.lightboxObserver.observe( this.wrapper, { attributes: true, attributeFilter: [ 'class' ] } );
	}

	/**
	 * Stop following size changes (panel closed or player disposed).
	 */
	unobserveLayout() {
		this.resizeObserver?.disconnect();
		this.lightboxObserver?.disconnect();
		this.observedParent = null;
		window.removeEventListener( 'resize', this.applyLayout );
	}

	/**
	 * Seek the player to a cue's start time.
	 *
	 * @param {number} index Cue index.
	 */
	seekToCue( index ) {
		const cue = this.cues[ index ];
		if ( ! cue ) {
			return;
		}
		this.player.currentTime( cue.start );
		this.setActiveCue( index );
	}

	/**
	 * Highlight the cue under the current playhead and keep it in view.
	 */
	handleTimeUpdate() {
		if ( ! this.isOpen || this.cues.length === 0 ) {
			return;
		}

		const time = this.player.currentTime();
		const index = this.cues.findIndex(
			( cue ) => time >= cue.start && time < cue.end,
		);

		if ( index !== -1 && index !== this.activeCueIndex ) {
			this.setActiveCue( index, true );
		}
	}

	/**
	 * Mark a cue row active, clearing the previous one.
	 *
	 * @param {number}  index          Cue index.
	 * @param {boolean} [scroll=false] Whether to scroll the row into view.
	 */
	setActiveCue( index, scroll = false ) {
		if ( this.activeCueIndex === index ) {
			return;
		}

		this.cueElements[ this.activeCueIndex ]?.classList.remove( ACTIVE_CUE_CLASS );
		const el = this.cueElements[ index ];
		if ( el ) {
			el.classList.add( ACTIVE_CUE_CLASS );
			if ( scroll ) {
				this.scrollCueIntoView( el );
			}
		}
		this.activeCueIndex = index;
	}

	/**
	 * Scroll the panel's own list so a cue is in view. Unlike
	 * `scrollIntoView()`, this never scrolls the page, which would yank the
	 * reader away mid-video. Instant when the visitor prefers reduced motion.
	 *
	 * @param {HTMLElement} el The cue row.
	 */
	scrollCueIntoView( el ) {
		const body = this.bodyEl;
		if ( ! body || el.hidden ) {
			return;
		}

		// Row position within the list's scrollable content.
		const top = el.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
		const bottom = top + el.offsetHeight;
		let target = null;
		if ( top < body.scrollTop ) {
			target = top;
		} else if ( bottom > body.scrollTop + body.clientHeight ) {
			target = bottom - body.clientHeight;
		}
		if ( target === null ) {
			return;
		}

		const behavior = this.reducedMotion?.matches ? 'auto' : 'smooth';
		if ( typeof body.scrollTo === 'function' ) {
			body.scrollTo( { top: target, behavior } );
		} else {
			body.scrollTop = target;
		}
	}

	/**
	 * Copy the full transcript text to the clipboard, with brief feedback.
	 *
	 * @param {HTMLElement} button The copy button (for visual feedback).
	 */
	copyTranscript( button ) {
		const text = this.cues.map( ( cue ) => cue.text ).join( '\n' );
		const showFeedback = () => {
			button.innerHTML = CHECK_ICON_SVG;
			button.classList.add( `${ PANEL_CLASS }__copy--done` );
			clearTimeout( this.copyResetTimeout );
			this.copyResetTimeout = setTimeout( () => {
				button.innerHTML = COPY_ICON_SVG;
				button.classList.remove( `${ PANEL_CLASS }__copy--done` );
			}, COPY_FEEDBACK_DELAY );
		};

		if ( navigator.clipboard?.writeText ) {
			navigator.clipboard.writeText( text ).then( showFeedback ).catch( () => {} );
		}
	}

	/**
	 * Tear down listeners and DOM (on player dispose).
	 */
	destroy() {
		clearTimeout( this.copyResetTimeout );
		this.player.off( 'timeupdate', this.handleTimeUpdate );
		this.player.off( 'fullscreenchange', this.applyLayout );
		this.player.off( 'customfullscreenchange', this.applyLayout );
		// The reparenting helper removes its own fullscreen listeners on dispose.
		this.isOpen = false;
		this.unobserveLayout();
		this.clearLayout();
		this.wrapper?.classList.remove( OPEN_CLASS );
		this.wrapper?.classList.remove( HAS_PANEL_CLASS );
		this.container?.classList.remove( 'godam-has-transcript' );
		this.button?.remove();
		this.panel?.remove();
	}
}
