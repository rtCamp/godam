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
	const figure = panel.closest( '.wp-block-godam-audio' );
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
		copyBtn.innerHTML = '<span class="dashicons dashicons-admin-page"></span>';
		copyBtn.addEventListener( 'click', async () => {
			if ( ! navigator.clipboard?.writeText ) {
				return;
			}
			await navigator.clipboard.writeText( cues.map( ( cue ) => cue.text ).join( '\n' ) );
			copyBtn.classList.add( 'is-copied' );
			setTimeout( () => copyBtn.classList.remove( 'is-copied' ), 2000 );
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

/**
 * Replace the native `<audio controls>` chrome with the minimal custom player
 * from the design (plain play/pause triangle, progress bar, duration). Native
 * controls remain the no-JS fallback — they're only removed once we've built
 * the custom UI.
 *
 * @param {HTMLElement} figure The `.wp-block-godam-audio` element.
 */
function enhancePlayer( figure ) {
	const audio = figure.querySelector( 'audio.godam-audio-card__player' );
	if ( ! audio || audio.dataset.godamEnhanced ) {
		return;
	}
	audio.dataset.godamEnhanced = '1';
	audio.removeAttribute( 'controls' );

	const player = document.createElement( 'div' );
	player.className = 'godam-audio-player';

	const playBtn = document.createElement( 'button' );
	playBtn.type = 'button';
	playBtn.className = 'godam-audio-player__play';
	playBtn.setAttribute( 'aria-label', __( 'Play', 'godam' ) );
	playBtn.innerHTML = PLAY_ICON;

	const scrubber = document.createElement( 'input' );
	scrubber.type = 'range';
	scrubber.className = 'godam-audio-player__scrubber';
	scrubber.min = '0';
	scrubber.max = '0';
	scrubber.step = '0.1';
	scrubber.value = '0';
	scrubber.setAttribute( 'aria-label', __( 'Seek', 'godam' ) );

	const time = document.createElement( 'span' );
	time.className = 'godam-audio-player__time';
	time.textContent = '0:00';

	player.append( playBtn, scrubber, time );
	audio.parentNode.insertBefore( player, audio.nextSibling );

	const syncProgress = () => {
		const max = Number( scrubber.max ) || 0;
		const pct = max > 0 ? ( audio.currentTime / max ) * 100 : 0;
		scrubber.value = audio.currentTime;
		scrubber.style.setProperty( '--godam-audio-progress', `${ pct }%` );
	};

	playBtn.addEventListener( 'click', () => {
		if ( audio.paused ) {
			audio.play();
		} else {
			audio.pause();
		}
	} );
	audio.addEventListener( 'play', () => {
		playBtn.innerHTML = PAUSE_ICON;
		playBtn.setAttribute( 'aria-label', __( 'Pause', 'godam' ) );
	} );
	const showPlay = () => {
		playBtn.innerHTML = PLAY_ICON;
		playBtn.setAttribute( 'aria-label', __( 'Play', 'godam' ) );
	};
	audio.addEventListener( 'pause', showPlay );
	audio.addEventListener( 'ended', showPlay );
	audio.addEventListener( 'loadedmetadata', () => {
		scrubber.max = audio.duration || 0;
		// Match the design: show the total duration.
		time.textContent = formatTime( audio.duration || 0 );
		syncProgress();
	} );
	audio.addEventListener( 'timeupdate', syncProgress );
	scrubber.addEventListener( 'input', () => {
		audio.currentTime = Number( scrubber.value );
	} );
}

const init = () => {
	document.querySelectorAll( '.wp-block-godam-audio' ).forEach( enhancePlayer );
	document.querySelectorAll( '[data-godam-audio-panel]' ).forEach( initAudioPanel );
};

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', init );
} else {
	init();
}
