// let chapters = [];
let currentChapterIndex = -1;

// Function to format time in MM:SS format
function formatTime( seconds ) {
	if ( seconds >= 3600 ) {
		// HH:MM:SS format
		const hours = Math.floor( seconds / 3600 );
		const mins = Math.floor( ( seconds % 3600 ) / 60 );
		const secs = Math.floor( seconds % 60 );
		return `${ hours }:${ mins.toString().padStart( 2, '0' ) }:${ secs.toString().padStart( 2, '0' ) }`;
	}
	// MM:SS format
	const mins = Math.floor( seconds / 60 );
	const secs = Math.floor( seconds % 60 );
	return `${ mins }:${ secs.toString().padStart( 2, '0' ) }`;
}

// Function to create chapter markers on progress bar
export function createChapterMarkers( player, chapters ) {
	const progressHolder = player.el().querySelector( '.vjs-progress-holder' );

	if ( ! progressHolder ) {
		return;
	}

	// Remove existing markers
	progressHolder.querySelectorAll( '.chapter-segment' )?.forEach( ( marker ) => {
		marker.remove();
	} );

	const duration = player.duration();
	if ( ! duration || duration === 0 ) {
		return;
	}
	const playProgress = player.el().querySelector( '.vjs-play-progress' );

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
			player.currentTime( chapter.startTime );
			updateActiveChapter( chapter.startTime, chapters );
		} );

		progressHolder.appendChild( segment );
	} );

	player.on( 'timeupdate', () => {
		const currentTime = player.currentTime();

		chapters.forEach( ( chapter, index ) => {
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
	} );
}

// Function to update active chapter
export function updateActiveChapter( currentTime, chapters ) {
	const newChapterIndex = chapters.findIndex( ( chapter, index ) => {
		const nextChapter = chapters[ index + 1 ];
		return (
			currentTime >= chapter.startTime &&
      ( ! nextChapter || currentTime < nextChapter.startTime )
		);
	} );

	if ( newChapterIndex !== currentChapterIndex ) {
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

		currentChapterIndex = newChapterIndex;
	}
}

// Load chapters from text input
export function loadChapters( player, chapters ) {
	// Create markers if video duration is available
	if ( player.duration() && player.duration() !== Infinity ) {
		createChapterMarkers( player, chapters );
	}
}
