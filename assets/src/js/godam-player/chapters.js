// let chapters = [];
let currentChapterIndex = -1;

// Function to parse time string (e.g., "1:23" or "0:05") to seconds
function parseTimeToSeconds( timeStr ) {
	const parts = timeStr.split( ':' ).map( ( part ) => parseInt( part, 10 ) );

	if ( parts.length === 2 ) {
		// MM:SS format
		return parts[ 0 ] * 60 + parts[ 1 ];
	} else if ( parts.length === 3 ) {
		// HH:MM:SS format
		return parts[ 0 ] * 3600 + parts[ 1 ] * 60 + parts[ 2 ];
	}

	return 0;
}

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

// Function to parse chapters from text
// function parseChaptersFromText( text, chapters ) {
// 	const lines = text.split( '\n' ).filter( ( line ) => line.trim() );
// 	const parsedChapters = [];
// 	const errors = [];

// 	lines.forEach( ( line, index ) => {
// 		const trimmedLine = line.trim();
// 		const match = trimmedLine.match( /^(\d+(?::\d+)*)\s+(.+)$/ );

// 		if ( ! match ) {
// 			errors.push( `Line ${ index + 1 }: Invalid format - "${ trimmedLine }"` );
// 			return;
// 		}

// 		const timeStr = match[ 1 ];
// 		const title = match[ 2 ];
// 		const startTime = parseTimeToSeconds( timeStr );

// 		parsedChapters.push( {
// 			startTime,
// 			text: title,
// 			originalTime: timeStr,
// 		} );
// 	} );

// 	// Sort chapters by start time
// 	parsedChapters.sort( ( a, b ) => a.startTime - b.startTime );

// 	// Add end times
// 	for ( let i = 0; i < parsedChapters.length; i++ ) {
// 		if ( i < parsedChapters.length - 1 ) {
// 			parsedChapters[ i ].endTime = parsedChapters[ i + 1 ].startTime;
// 		} else {
// 			parsedChapters[ i ].endTime = null; // Will be set to video duration
// 		}
// 	}

// 	return { chapters: parsedChapters, errors };
// }

// Function to create chapter markers on progress bar
export function createChapterMarkers( player, chapters ) {
	const progressHolder = player.el().querySelector( '.vjs-progress-holder' );

	if ( ! progressHolder ) {
		return;
	}

	// Remove existing markers
	progressHolder.querySelectorAll( '.chapter-marker' ).forEach( ( marker ) => {
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

	console.log( 'Chapters in chapters.js:', chapters );

	chapters?.forEach( ( chapter, index ) => {
		const video = player.el().querySelector( 'video' );
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
// function captureFrameAtTime( player, timeInSeconds ) {
// 	const video = player.el().querySelector( 'video' );
// 	const videoId = video.dataset.id;
// 	const imgId = `chapter-preview-${ videoId }-${ timeInSeconds }`;

// 	function drawFrame() {
// 		try {
// 			if ( video.videoWidth === 0 || video.videoHeight === 0 ) {
// 				console.warn( 'Video not ready yet' );
// 				return;
// 			}

// 			const canvas = document.createElement( 'canvas' );
// 			canvas.width = video.videoWidth;
// 			canvas.height = video.videoHeight;

// 			const ctx = canvas.getContext( '2d' );
// 			ctx.drawImage( video, 0, 0, canvas.width, canvas.height );

// 			const imageDataURL = canvas.toDataURL( 'image/png' );

// 			const imgEl = document.getElementById( imgId );
// 			if ( imgEl ) {
// 				imgEl.src = imageDataURL;
// 			} else {
// 				console.warn( 'Image element not found:', imgId );
// 			}
// 		} catch ( e ) {
// 			console.error( 'Capture failed:', e );
// 		}
// 	}

// 	if ( video.readyState < 2 ) {
// 		video.addEventListener( 'loadedmetadata', () => {
// 			player.one( 'seeked', drawFrame );
// 			player.currentTime( timeInSeconds );
// 		} );
// 	} else {
// 		player.one( 'seeked', drawFrame );
// 		player.currentTime( timeInSeconds );
// 	}
// }

function captureFrameAtTime( player, timeInSeconds ) {
	const video = player.el().querySelector( 'video' );
	const videoId = video.dataset.id;
	const imgId = `chapter-preview-${ videoId }-${ timeInSeconds }`;

	function drawFrame() {
		if ( Math.abs( player.currentTime() - timeInSeconds ) > 0.1 ) {
			console.warn( 'Seek not accurate yet. Waiting again...' );
			player.one( 'seeked', drawFrame ); // Retry once more
			return;
		}

		try {
			if ( video.videoWidth === 0 || video.videoHeight === 0 ) {
				console.warn( 'Video dimensions not ready' );
				return;
			}

			const canvas = document.createElement( 'canvas' );
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;

			const ctx = canvas.getContext( '2d' );
			ctx.drawImage( video, 0, 0, canvas.width, canvas.height );

			const imageDataURL = canvas.toDataURL( 'image/png' );

			const imgEl = document.getElementById( imgId );
			if ( imgEl ) {
				imgEl.src = imageDataURL;
			} else {
				console.warn( 'Image element not found:', imgId );
			}
		} catch ( e ) {
			console.error( 'Capture failed:', e );
		}
	}

	// Ensure player has loaded metadata
	if ( video.readyState < 1 ) {
		video.addEventListener( 'loadedmetadata', () => {
			player.one( 'seeked', drawFrame );
			player.currentTime( timeInSeconds );
		} );
	} else {
		player.one( 'seeked', drawFrame );
		player.currentTime( timeInSeconds );
	}
}

// Function to create chapters list UI
function createChaptersList( chaptersData, player, chapters ) {
	const container = document.getElementById( 'chapters-container' );
	container.innerHTML = '';

	if ( chaptersData.length === 0 ) {
		container.innerHTML =
      '<p style="color: #666; font-style: italic;">No chapters loaded</p>';
		return;
	}

	chaptersData.forEach( ( chapter, index ) => {
		const chapterEl = document.createElement( 'div' );
		chapterEl.className = 'chapter-item';
		chapterEl.setAttribute( 'data-chapter', index );

		chapterEl.innerHTML = `
                    <button class="chapter-time">${ formatTime( chapter.startTime ) }</button>
                    <div class="chapter-title">${ chapter.text }</div>
                `;

		chapterEl.addEventListener( 'click', () => {
			player.currentTime( chapter.startTime );
			updateActiveChapter( chapter.startTime, chapters );
		} );

		container.appendChild( chapterEl );
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

// Function to show error message
function showError( message ) {
	const errorEl = document.getElementById( 'error-message' );
	errorEl.textContent = message;
	errorEl.style.display = 'block';
	setTimeout( () => {
		errorEl.style.display = 'none';
	}, 5000 );
}

// Load chapters from text input
export function loadChapters( player, chapters ) {
	// createChaptersList( chapters, player );
	// addChaptersButton();

	// Create markers if video duration is available
	if ( player.duration() && player.duration() !== Infinity ) {
		createChapterMarkers( player, chapters );
	}

	console.log( 'Loaded chapters:', chapters );
}
