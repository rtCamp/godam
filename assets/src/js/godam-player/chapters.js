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
	progressHolder.querySelectorAll( '.chapter-marker' )?.forEach( ( marker ) => {
		marker.remove();
	} );

	const duration = player.duration();
	if ( ! duration || duration === 0 ) {
		return;
	}

	// Set end time for last chapter
	if ( chapters?.length > 0 && chapters[ chapters?.length - 1 ]?.endTime === null ) {
		chapters[ chapters.length - 1 ].endTime = duration;
	}

	chapters?.forEach( ( chapter, index ) => {
		const percentage = ( chapter.startTime / duration ) * 100;

		const marker = document.createElement( 'div' );
		marker.className = 'chapter-marker';
		marker.style.left = `${ percentage }%`;
		const chapterDuration = chapter.endTime - chapter.startTime;
		const widthPercent = ( chapterDuration / duration ) * 100;
		marker.style.width = index === chapters.length - 1 ? `${ widthPercent }%` : `${ widthPercent - 0.8 }%`;
		marker.setAttribute( 'data-chapter', index );

		// Create tooltip
		const tooltip = document.createElement( 'div' );
		tooltip.className = 'chapter-tooltip';
		tooltip.textContent = `${ formatTime( chapter.startTime ) } - ${ chapter.text }`;

		marker.appendChild( tooltip );

		// Add click event
		marker.addEventListener( 'click', ( e ) => {
			e.stopPropagation();
			player.currentTime( chapter.startTime );
			updateActiveChapter( chapter.startTime, chapters );
		} );

		progressHolder.appendChild( marker );
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
