/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { parseDataAttribute, formatTime } from '../utils/dataHelpers.js';

/**
 * Chapters Manager
 * Handles video chapters, markers, and navigation
 */
export default class ChaptersManager {
	constructor( player, video ) {
		this.player = player;
		this.video = video;
		this.chaptersData = [];
		this.currentChapterIndex = -1;
		this.bindMethods();
		this.setupEventListeners();
	}

	/**
	 * Bind methods to maintain context
	 */
	bindMethods() {
		this.handleTimeUpdate = this.handleTimeUpdate.bind( this );
		this.handleDurationChange = this.handleDurationChange.bind( this );
	}

	/**
	 * Setup event listeners
	 */
	setupEventListeners() {
		this.player.on( 'durationchange', this.handleDurationChange );
		this.player.on( 'timeupdate', this.handleTimeUpdate );
	}

	/**
	 * Get chapters data from video options
	 *
	 * @return {Array} Processed chapters data
	 */
	getChaptersData() {
		const videoSetupOptions = parseDataAttribute( this.video, 'options', {} );
		const chapters = videoSetupOptions?.chapters;

		if ( ! Array.isArray( chapters ) || chapters.length === 0 ) {
			return [];
		}

		const seenTimes = new Set();

		// Filter out invalid entries
		const filteredChapters = chapters.filter( ( chapter ) => {
			const time = parseFloat( chapter.startTime );

			if ( ! chapter.startTime || isNaN( time ) || time < 0 || seenTimes.has( time ) ) {
				return false;
			}

			seenTimes.add( time );
			return true;
		} );

		// Convert to required format
		return filteredChapters.map( ( chapter ) => ( {
			startTime: parseFloat( chapter.startTime ) || 0,
			text: chapter.text || __( 'Chapter', 'godam' ),
			originalTime: chapter.originalTime,
			endTime: null,
		} ) );
	}

	/**
	 * Initialize chapters from video data
	 */
	initialize() {
		const chaptersData = this.getChaptersData();
		if ( chaptersData?.length > 0 ) {
			this.processChaptersData( chaptersData );
		}
	}

	/**
	 * Create chapter markers on progress bar
	 *
	 * @param {Array} chapters - Chapters data array
	 */
	createChapterMarkers( chapters ) {
		const progressHolder = this.player.el().querySelector( '.vjs-progress-holder' );

		if ( ! progressHolder ) {
			return;
		}

		// Remove existing markers
		progressHolder.querySelectorAll( '.chapter-segment' )?.forEach( ( marker ) => {
			marker.remove();
		} );

		const duration = this.player.duration();
		if ( ! duration || duration === 0 ) {
			return;
		}
		const playProgress = this.player.el().querySelector( '.vjs-play-progress' );

		const loadProgress = this.player.el().querySelector( '.vjs-load-progress' );

		if ( loadProgress ) {
			loadProgress.classList.add( 'chapter-load-progress' );
		}

		playProgress.style.height = 'unset';// Reset height to allow markers to be drawn.

		// Set end time for last chapter
		if ( chapters?.length > 0 && chapters[ chapters?.length - 1 ]?.endTime === null ) {
			chapters[ chapters.length - 1 ].endTime = duration;
		}

		chapters?.forEach( ( chapter, index ) => {
			const percentage = ( chapter.startTime / duration ) * 100;
			const chapterDuration = chapter.endTime - chapter.startTime;
			const widthPercent = ( chapterDuration / duration ) * 100;

			const segment = document.createElement( 'div' );
			segment.className = 'chapter-segment';
			segment.style.left = `${ percentage }%`;
			segment.style.width =
				index === chapters.length - 1 ? `${ widthPercent }%` : `${ widthPercent - 0.8 }%`;

			const fill = document.createElement( 'div' );
			fill.className = 'chapter-fill';
			fill.dataset.chapter = index;
			segment.appendChild( fill );

			const tooltip = document.createElement( 'div' );
			tooltip.className = 'chapter-tooltip';
			tooltip.textContent = `${ formatTime( chapter.startTime ) } - ${ chapter.text }`;
			segment.appendChild( tooltip );

			segment.addEventListener( 'click', ( e ) => {
				e.stopPropagation();
				this.player.currentTime( chapter.startTime );
				this.updateActiveChapter( chapter.startTime, chapters );
			} );

			progressHolder.appendChild( segment );
		} );
	}

	/**
	 * Handle time update events for chapter progress tracking
	 */
	handleTimeUpdate() {
		const progressHolder = this.player.el().querySelector( '.vjs-progress-holder' );

		if ( ! progressHolder || ! this.chaptersData.length ) {
			return;
		}

		const currentTime = this.player.currentTime();

		this.chaptersData.forEach( ( chapter, index ) => {
			const fill = progressHolder.querySelector(
				`.chapter-fill[data-chapter="${ index }"]`,
			);

			if ( ! fill ) {
				return;
			}

			if ( currentTime >= chapter.endTime ) {
				// Chapter fully played
				fill.style.width = '100%';
			} else if (
				currentTime >= chapter.startTime &&
				currentTime < chapter.endTime
			) {
				// Chapter partially played
				const played = currentTime - chapter.startTime;
				const chapterDuration = chapter.endTime - chapter.startTime;
				const percent = ( played / chapterDuration ) * 100;
				fill.style.width = `${ percent }%`;
			} else {
				// Not reached yet
				fill.style.width = '0%';
			}
		} );

		// Update active chapter
		this.updateActiveChapter( currentTime, this.chaptersData );
	}

	/**
	 * Update active chapter
	 *
	 * @param {number} currentTime - Current video time
	 * @param {Array}  chapters    - Chapters data array
	 */
	updateActiveChapter( currentTime, chapters ) {
		const newChapterIndex = chapters.findIndex( ( chapter, index ) => {
			const nextChapter = chapters[ index + 1 ];
			return (
				currentTime >= chapter.startTime &&
				( ! nextChapter || currentTime < nextChapter.startTime )
			);
		} );

		if ( newChapterIndex !== this.currentChapterIndex ) {
			// Remove previous active class
			document.querySelectorAll( '.chapter-item' ).forEach( ( el ) => {
				el.classList.remove( 'active' );
			} );

			// Add active class to current chapter
			if ( newChapterIndex >= 0 ) {
				const activeEl = document.querySelector(
					`[data-chapter="${ newChapterIndex }"]`,
				);
				if ( activeEl ) {
					activeEl.classList.add( 'active' );
				}
			}

			this.currentChapterIndex = newChapterIndex;
		}
	}

	/**
	 * Load chapters and create markers
	 *
	 * @param {Array} chapters - Chapters data array
	 */
	loadChapters( chapters ) {
		// Create markers if video duration is available
		if ( this.player.duration() && this.player.duration() !== Infinity ) {
			this.createChapterMarkers( chapters );
		}
	}

	/**
	 * Process chapters data and initialize chapters
	 *
	 * @param {Array} chaptersData - Chapters data array
	 */
	processChaptersData( chaptersData ) {
		// Sort chapters by start time
		chaptersData.sort( ( a, b ) => a.startTime - b.startTime );

		// Calculate end times
		chaptersData.forEach( ( chapter, index ) => {
			if ( index < chaptersData.length - 1 ) {
				chapter.endTime = chaptersData[ index + 1 ].startTime;
			} else {
				chapter.endTime = null; // Will be set to video duration when available
			}
		} );

		// Store chapters data
		this.chaptersData = chaptersData;

		// Load chapters
		this.loadChapters( chaptersData );
	}

	/**
	 * Handle duration change events
	 */
	handleDurationChange() {
		const duration = this.player.duration();
		if ( ! duration || duration === Infinity || ! this.chaptersData?.length ) {
			return;
		}

		// Filter chapters beyond duration
		this.chaptersData = this.chaptersData.filter( ( ch ) => ch.startTime < duration );

		// Set endTime for the last valid chapter
		if ( this.chaptersData.length > 0 ) {
			this.chaptersData[ this.chaptersData.length - 1 ].endTime = duration;
			this.createChapterMarkers( this.chaptersData );
		}
	}

	/**
	 * Clean up event listeners
	 */
	destroy() {
		if ( this.player ) {
			this.player.off( 'durationchange', this.handleDurationChange );
			this.player.off( 'timeupdate', this.handleTimeUpdate );
		}
	}
}
