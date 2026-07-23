/**
 * External dependencies
 */
import videojs from 'video.js';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { setupFullscreenReparenting } from '../utils/fullscreenReparent.js';

// Minimum container width (px) at which the Bubble skin routes the button into
// the control bar instead of overlaying it — matches ShareManager.
const MIN_BUBBLE_WIDTH = 480;

// WordPress "copy" icon (matches @wordpress/icons `copy`).
const COPY_ICON_SVG = `<svg class="godam-transcript-panel__copy-icon" viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path fill-rule="evenodd" clip-rule="evenodd" d="M5 4.5h11a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5ZM3 5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Zm17 3v10.75c0 .69-.56 1.25-1.25 1.25H6v1.5h12.75a2.75 2.75 0 0 0 2.75-2.75V8H20Z" fill="currentColor"/></svg>`;

// WordPress "check" icon, shown briefly after a successful copy.
const CHECK_ICON_SVG = `<svg class="godam-transcript-panel__copy-icon" viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M16.7 7.1l-6.3 8.5-3.3-2.5-.9 1.2 4.5 3.4L17.9 8z" fill="currentColor"/></svg>`;

// WordPress "close" icon (matches @wordpress/icons `close`).
const CLOSE_ICON_SVG = `<svg class="godam-transcript-panel__close-icon" viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="m13.06 12 6.47-6.47-1.06-1.06L12 10.94 5.53 4.47 4.47 5.53 10.94 12l-6.47 6.47 1.06 1.06L12 13.06l6.47 6.47 1.06-1.06L13.06 12Z" fill="currentColor"/></svg>`;

// Transcript button icon (a document with text lines).
const TRANSCRIPT_ICON_SVG = `<svg class="godam-transcript-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
		<path d="M5 3.5h14a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5Z" stroke="currentColor" stroke-width="1.6"/>
		<path d="M7 8h10M7 12h10M7 16h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
	</svg>`;

// CSS class names.
const BUTTON_CLASS = 'godam-transcript-button';
const PANEL_CLASS = 'godam-transcript-panel';
const CUE_CLASS = 'godam-transcript-cue';
// Added to the video wrapper so the video + panel share the block width.
const OPEN_CLASS = 'godam-transcript-open';
// Added to the wrapper while a panel is present so its overflow/shadow can be
// clipped without relying on `:has()` (unsupported in some browsers).
const HAS_PANEL_CLASS = 'godam-has-transcript-panel';
const ACTIVE_CUE_CLASS = 'godam-transcript-cue--active';

// Copy feedback duration in ms.
const COPY_FEEDBACK_DELAY = 2000;

/**
 * Transcript Panel Manager
 *
 * Adds an on-video transcript toggle button (top-right corner, just before the
 * share button) that opens a side panel listing the video's transcription as
 * timestamped, clickable cues. Clicking a cue seeks the player; the cue under
 * the playhead is highlighted as the video plays.
 *
 * The transcript text reuses the same public API the TranscriptManager
 * uses to resolve the VTT URL, then loads the cues through a hidden Video.js
 * `metadata` text track so the browser handles all WebVTT parsing (and so the
 * VTT is fetched by the media element, sidestepping cross-origin fetch issues).
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
		this.Button = videojs.getComponent( 'Button' );

		this.container = null;
		this.wrapper = null;
		this.button = null;
		this.buttonInControlBar = false;
		this.panel = null;
		this.bodyEl = null;
		this.cues = [];
		this.cueElements = [];
		this.activeCueIndex = -1;
		this.copyResetTimeout = null;
		this.isOpen = false;

		this.handleTimeUpdate = this.handleTimeUpdate.bind( this );

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

		if ( ! this.jobId || this.video.dataset.disableTranscript === 'true' ) {
			return;
		}

		this.container = this.player.el().closest( '.easydam-video-container' );
		if ( ! this.container ) {
			return;
		}
		// The panel overlays the video (absolutely positioned inside the
		// wrapper) so the video keeps its full width when the transcript opens;
		// the wrapper is the positioned parent and the element we toggle.
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

		// `metadata` keeps the track out of the subtitles/captions menu; `hidden`
		// mode forces the browser to download and parse the cues without
		// rendering them on screen.
		const trackEl = this.player.addRemoteTextTrack(
			{
				kind: 'metadata',
				label: 'GoDAM Transcript',
				srclang: 'en',
				src: transcriptUrl,
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
					text: ( cue.text || '' ).replace( /[<>]/g, '' ).trim(),
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
		panel.className = PANEL_CLASS;
		panel.setAttribute( 'data-test-id', 'godam-video-transcript-panel' );

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

		const body = document.createElement( 'div' );
		body.className = `${ PANEL_CLASS }__body`;

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

			row.appendChild( time );
			row.appendChild( text );
			row.addEventListener( 'click', () => this.seekToCue( index ) );

			body.appendChild( row );
			return row;
		} );

		panel.appendChild( header );
		panel.appendChild( body );

		// Append inside the wrapper as an overlay so it sits above the video
		// without taking layout space (the video keeps its full width).
		this.wrapper.appendChild( panel );
		// Flag the wrapper so its overflow/shadow clip can be scoped with a plain
		// class selector instead of `:has()` (which some browsers lack).
		this.wrapper.classList.add( HAS_PANEL_CLASS );
		this.panel = panel;
		this.bodyEl = body;
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
		this.wrapper.classList.add( OPEN_CLASS );
		this.button?.setAttribute( 'aria-expanded', 'true' );
		this.button?.classList.add( `${ BUTTON_CLASS }--active` );
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
		this.isOpen = false;
		this.wrapper.classList.remove( OPEN_CLASS );
		this.button?.setAttribute( 'aria-expanded', 'false' );
		this.button?.classList.remove( `${ BUTTON_CLASS }--active` );
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
				el.scrollIntoView( { block: 'nearest', behavior: 'smooth' } );
			}
		}
		this.activeCueIndex = index;
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
		// Fullscreen listeners are removed by the reparenting helper on player
		// `dispose`; nothing to detach here.
		this.wrapper?.classList.remove( OPEN_CLASS );
		this.wrapper?.classList.remove( HAS_PANEL_CLASS );
		this.container?.classList.remove( 'godam-has-transcript' );
		this.button?.remove();
		this.panel?.remove();
	}
}
