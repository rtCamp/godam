/**
 * Front-end behaviour for the GoDAM Audio block's Chapters / Transcript panel.
 *
 * Progressive enhancement over the server-rendered markup: wires tab switching,
 * the collapse toggle, chapter click-to-seek, and (JS-only) the transcript —
 * fetched from the attachment's caption file, parsed, rendered, kept in sync
 * with playback, and copyable. Native `<audio controls>` handles playback, so
 * the panel is driven purely by the standard `timeupdate` event, making the
 * same logic reusable for any media element.
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { formatTime } from '../../js/godam-player/utils/dataHelpers';
import { parseCaptions } from '../../js/godam-player/utils/parseCaptions';

/**
 * Hydrate a single audio block's panel.
 *
 * @param {HTMLElement} panel The `[data-godam-audio-panel]` element.
 */
function initAudioPanel( panel ) {
	const figure = panel.closest( '.godam-audio' );
	const audio = figure?.querySelector( 'audio' );
	if ( ! audio ) {
		return;
	}

	// ── Tabs ────────────────────────────────────────────────────────────────
	const tabs = Array.from( panel.querySelectorAll( '.godam-audio-tabs__tab' ) );
	const bodies = Array.from( panel.querySelectorAll( '.godam-audio-tabs__panel' ) );
	tabs.forEach( ( tab ) => {
		tab.addEventListener( 'click', () => {
			const name = tab.dataset.godamTab;
			tabs.forEach( ( t ) => {
				const active = t === tab;
				t.classList.toggle( 'is-active', active );
				t.setAttribute( 'aria-selected', active ? 'true' : 'false' );
			} );
			bodies.forEach( ( b ) => {
				b.hidden = b.dataset.godamPanel !== name;
			} );
		} );
	} );

	// ── Collapse toggle ───────────────────────────────────────────────────────
	const toggle = panel.querySelector( '.godam-audio-tabs__toggle' );
	const body = panel.querySelector( '.godam-audio-tabs__body' );
	toggle?.addEventListener( 'click', () => {
		const expanded = toggle.getAttribute( 'aria-expanded' ) === 'true';
		toggle.setAttribute( 'aria-expanded', expanded ? 'false' : 'true' );
		panel.classList.toggle( 'is-collapsed', expanded );
		if ( body ) {
			body.hidden = expanded;
		}
	} );

	// ── Chapters: click to seek ─────────────────────────────────────────────
	const chapterRows = Array.from( panel.querySelectorAll( '.godam-audio-tabs__panel[data-godam-panel="chapters"] .godam-audio-tabs__row' ) );
	chapterRows.forEach( ( row ) => {
		row.addEventListener( 'click', () => {
			const time = parseFloat( row.dataset.godamStart );
			if ( Number.isFinite( time ) ) {
				audio.currentTime = time;
				audio.play?.();
			}
		} );
	} );

	// ── Transcript: fetch, parse, render ─────────────────────────────────────
	const transcriptUrl = panel.dataset.godamTranscript;
	const transcriptPanel = panel.querySelector( '[data-godam-panel="transcript"]' );
	let cues = [];
	let cueEls = [];

	const renderTranscript = () => {
		if ( ! transcriptPanel ) {
			return;
		}
		transcriptPanel.innerHTML = '';
		if ( ! cues.length ) {
			const empty = document.createElement( 'p' );
			empty.className = 'godam-audio-tabs__empty';
			empty.textContent = __( 'No transcript to show', 'godam' );
			transcriptPanel.appendChild( empty );
			return;
		}

		const copyBtn = document.createElement( 'button' );
		copyBtn.type = 'button';
		copyBtn.className = 'godam-audio-tabs__copy';
		copyBtn.setAttribute( 'aria-label', __( 'Copy transcript', 'godam' ) );
		copyBtn.innerHTML = COPY_ICON;
		let copyResetTimer;
		copyBtn.addEventListener( 'click', async () => {
			if ( ! navigator.clipboard?.writeText ) {
				return;
			}
			await navigator.clipboard.writeText( cues.map( ( cue ) => cue.text ).join( '\n' ) );
			// Confirm the copy with a check mark for a moment, then restore.
			copyBtn.classList.add( 'is-copied' );
			copyBtn.innerHTML = CHECK_ICON;
			copyBtn.setAttribute( 'aria-label', __( 'Copied', 'godam' ) );
			clearTimeout( copyResetTimer );
			copyResetTimer = setTimeout( () => {
				copyBtn.classList.remove( 'is-copied' );
				copyBtn.innerHTML = COPY_ICON;
				copyBtn.setAttribute( 'aria-label', __( 'Copy transcript', 'godam' ) );
			}, 2000 );
		} );
		transcriptPanel.appendChild( copyBtn );

		const list = document.createElement( 'div' );
		list.className = 'godam-audio-tabs__transcript';
		cueEls = cues.map( ( cue ) => {
			const rowBtn = document.createElement( 'button' );
			rowBtn.type = 'button';
			rowBtn.className = 'godam-audio-tabs__row godam-audio-tabs__cue';
			const stamp = document.createElement( 'span' );
			stamp.className = 'godam-audio-tabs__stamp';
			stamp.textContent = formatTime( cue.start );
			const text = document.createElement( 'span' );
			text.className = 'godam-audio-tabs__row-text';
			text.textContent = cue.text;
			rowBtn.append( stamp, text );
			rowBtn.addEventListener( 'click', () => {
				audio.currentTime = cue.start;
				audio.play?.();
			} );
			list.appendChild( rowBtn );
			return rowBtn;
		} );
		transcriptPanel.appendChild( list );
	};

	if ( transcriptUrl && transcriptPanel ) {
		fetch( transcriptUrl )
			.then( ( response ) => ( response.ok ? response.text() : '' ) )
			.then( ( text ) => {
				cues = parseCaptions( text );
				renderTranscript();
			} )
			.catch( () => {
				cues = [];
				renderTranscript();
			} );
	}

	// ── Active-line sync (chapters + transcript) ─────────────────────────────
	audio.addEventListener( 'timeupdate', () => {
		const time = audio.currentTime;

		chapterRows.forEach( ( row, index ) => {
			const start = parseFloat( row.dataset.godamStart );
			const nextStart = index + 1 < chapterRows.length
				? parseFloat( chapterRows[ index + 1 ].dataset.godamStart )
				: Infinity;
			row.classList.toggle( 'is-active', time >= start && time < nextStart );
		} );

		if ( cueEls.length ) {
			const activeIndex = cues.findIndex( ( cue ) => time >= cue.start && time < cue.end );
			cueEls.forEach( ( el, index ) => el.classList.toggle( 'is-active', index === activeIndex ) );
			// Keep the active cue visible, but only when the transcript is open
			// so playback never yanks the page while another tab is showing.
			if ( activeIndex >= 0 && transcriptPanel && ! transcriptPanel.hidden ) {
				cueEls[ activeIndex ].scrollIntoView( { block: 'nearest' } );
			}
		}
	} );
}

const PLAY_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
const PAUSE_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor"/></svg>';
// WordPress "copy" / "check" icons (match @wordpress/icons `copy` / `check`).
const COPY_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M5 4.5h11a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5ZM3 5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Zm17 3v10.75c0 .69-.56 1.25-1.25 1.25H6v1.5h12.75a2.75 2.75 0 0 0 2.75-2.75V8H20Z"/></svg>';
const CHECK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16.7 7.1l-6.3 8.5-3.3-2.5-.9 1.2 4.5 3.4L17.9 8z"/></svg>';

/**
 * Wire playback onto the server-rendered custom player (plain play/pause
 * triangle, progress bar, duration). The markup is emitted by render.php so
 * there is no flash of native `<audio controls>`; a <noscript> fallback there
 * restores native controls when JavaScript is unavailable. This only attaches
 * behaviour to the existing elements.
 *
 * @param {HTMLElement} figure The `.godam-audio` element (block or shortcode).
 */
function enhancePlayer( figure ) {
	const audio = figure.querySelector( 'audio.godam-audio-card__player' );
	const player = figure.querySelector( '.godam-audio-player' );
	if ( ! audio || ! player || player.dataset.godamEnhanced ) {
		return;
	}

	const playBtn = player.querySelector( '.godam-audio-player__play' );
	const scrubber = player.querySelector( '.godam-audio-player__scrubber' );
	const time = player.querySelector( '.godam-audio-player__time' );
	if ( ! playBtn || ! scrubber || ! time ) {
		return;
	}
	player.dataset.godamEnhanced = '1';

	const syncProgress = () => {
		const max = Number( scrubber.max ) || 0;
		const pct = max > 0 ? ( audio.currentTime / max ) * 100 : 0;
		scrubber.value = audio.currentTime;
		scrubber.style.setProperty( '--godam-audio-progress', `${ pct }%` );
	};

	const showPause = () => {
		playBtn.innerHTML = PAUSE_ICON;
		playBtn.setAttribute( 'aria-label', __( 'Pause', 'godam' ) );
	};
	const showPlay = () => {
		playBtn.innerHTML = PLAY_ICON;
		playBtn.setAttribute( 'aria-label', __( 'Play', 'godam' ) );
	};

	// Reflect the duration in the scrubber + time display. Called on
	// loadedmetadata and also immediately below in case metadata already
	// loaded before this deferred script ran (server-rendered markup).
	const initDuration = () => {
		scrubber.max = audio.duration || 0;
		// Match the design: show the total duration.
		time.textContent = formatTime( audio.duration || 0 );
		syncProgress();
	};

	playBtn.addEventListener( 'click', () => {
		if ( audio.paused ) {
			audio.play();
		} else {
			audio.pause();
		}
	} );
	audio.addEventListener( 'play', showPause );
	audio.addEventListener( 'pause', showPlay );
	audio.addEventListener( 'ended', showPlay );
	audio.addEventListener( 'loadedmetadata', initDuration );
	audio.addEventListener( 'timeupdate', syncProgress );
	scrubber.addEventListener( 'input', () => {
		audio.currentTime = Number( scrubber.value );
	} );

	// Sync state that may already have settled before wiring (deferred script):
	// metadata (duration) and an in-progress autoplay.
	if ( audio.readyState >= 1 && audio.duration ) {
		initDuration();
	}
	if ( ! audio.paused ) {
		showPause();
	}
}

const init = () => {
	document.querySelectorAll( '.godam-audio' ).forEach( enhancePlayer );
	document.querySelectorAll( '[data-godam-audio-panel]' ).forEach( initAudioPanel );
};

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', init );
} else {
	init();
}
