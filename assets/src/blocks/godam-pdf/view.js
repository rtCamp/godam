/**
 * Frontend script for GoDAM PDF Block
 * Handles PDF source fallback if the primary source is unavailable
 */

document.addEventListener( 'DOMContentLoaded', function() {
	const pdfWrappers = document.querySelectorAll( '.godam-pdf-wrapper' );
	// Check if safari browser or iOS device
	const isIOS = /iPad|iPhone|iPod/.test( navigator.userAgent ) && ! window.MSStream;
	const isSafari = /^((?!chrome|android).)*safari/i.test( navigator.userAgent );

	if ( isIOS || isSafari ) {
		// Handle for Safari/iOS
		pdfWrappers.forEach( function( wrapper ) {
			const pdfObject = wrapper.querySelector( 'object[type="application/pdf"]' );
			if ( ! pdfObject ) {
				return;
			}

			// Get the sources from data attribute
			const sourcesData = pdfObject.getAttribute( 'data-sources' );
			if ( ! sourcesData ) {
				return;
			}

			let sources = [];
			try {
				sources = JSON.parse( sourcesData );
			} catch ( e ) {
				return;
			}

			if ( sources.length === 0 ) {

			}

			function bust( url ) {
				return url + '?v=' + Date.now();
			}

			async function pdfExists( url ) {
				try {
					const res = await fetch( url, {
						method: 'HEAD',
						cache: 'no-store',
					} );
					return res.ok;
				} catch ( e ) {
					return false;
				}
			}

			async function loadFirstAvailablePDF() {
				for ( const src of sources ) {
					const busted = bust( src );
					const exists = await pdfExists( busted );

					if ( exists ) {
						pdfObject.setAttribute( 'data', busted );
						return;
					}
				}
			}

			// Wait 1 second before checking (Safari-friendly delay)
			setTimeout( loadFirstAvailablePDF, 100 );
		} );
	} else {
		pdfWrappers.forEach( function( wrapper ) {
			const pdfObject = wrapper.querySelector( 'object[type="application/pdf"]' );
			if ( ! pdfObject ) {
				return;
			}

			// Get the sources from data attribute
			const sourcesData = pdfObject.getAttribute( 'data-sources' );
			if ( ! sourcesData ) {
				return;
			}

			let sources = [];
			try {
				sources = JSON.parse( sourcesData );
			} catch ( e ) {
				return;
			}

			if ( sources.length === 0 ) {
				return;
			}

			let loadCheckTimeout = null;

			/**
			 * Try to load the next available PDF source
			 *
			 * @param {number} index - The index of the source to try
			 */
			function tryNextSource( index ) {
				if ( index >= sources.length ) {
					// No more sources to try
					const currentObject = wrapper.querySelector( 'object[type="application/pdf"]' );
					const fallbackMessage = currentObject ? currentObject.querySelector( 'p' ) : null;
					if ( fallbackMessage ) {
						fallbackMessage.innerHTML =
							'<strong>Unable to load PDF.</strong> All sources are unavailable.';
					}
					return;
				}

				const currentSource = sources[ index ];

				// Update the object with the new source
				updatePDFObject( currentSource, index );

				// Set a timeout to check if PDF loads
				// If it doesn't load within 10 seconds, try the next source
				if ( loadCheckTimeout ) {
					clearTimeout( loadCheckTimeout );
				}

				loadCheckTimeout = setTimeout( function() {
					// Check if the object is actually displaying the PDF
					// by checking if the fallback content is visible
					const currentObject = wrapper.querySelector( 'object[type="application/pdf"]' );
					const fallbackContent = currentObject ? currentObject.querySelector( 'p' ) : null;
					if ( fallbackContent && isVisible( fallbackContent ) ) {
						// Fallback content is visible, meaning PDF didn't load
						tryNextSource( index + 1 );
					}
				}, 10000 ); // 10 second timeout
			}

			/**
			 * Check if an element is visible
			 *
			 * @param {HTMLElement} element - The element to check
			 * @return {boolean} - Whether the element is visible
			 */
			function isVisible( element ) {
				return element.offsetWidth > 0 && element.offsetHeight > 0;
			}

			/**
			 * Update the PDF object with a new source
			 *
			 * @param {string} newSource   - The new PDF source URL
			 * @param {number} sourceIndex - The index of the source
			 */
			function updatePDFObject( newSource, sourceIndex ) {
				// Get the current object from the wrapper (in case it was replaced)
				const currentObject = wrapper.querySelector( 'object[type="application/pdf"]' );
				if ( ! currentObject ) {
					return;
				}

				// Only update if it's a different source
				if ( currentObject.getAttribute( 'data' ) === newSource ) {
					return;
				}

				// Create a completely new object element
				const newObject = document.createElement( 'object' );
				newObject.id = currentObject.id || 'pdfObject';
				newObject.type = 'application/pdf';
				newObject.width = '100%';
				newObject.height = '100%';
				newObject.setAttribute( 'data', newSource );
				newObject.setAttribute( 'data-sources', sourcesData );
				newObject.setAttribute( 'data-current-index', sourceIndex );

				// Copy the fallback content
				const fallbackContent = currentObject.querySelector( 'p' );
				if ( fallbackContent ) {
					const newFallback = fallbackContent.cloneNode( true );
					const downloadLink = newFallback.querySelector( 'a' );
					if ( downloadLink ) {
						downloadLink.href = newSource;
					}
					newObject.appendChild( newFallback );
				}

				// Add error event listener to the new object
				newObject.addEventListener( 'error', function() {
					const currentIndex = parseInt( newObject.getAttribute( 'data-current-index' ) || '0', 10 );

					// Clear the load check timeout since we got an error
					if ( loadCheckTimeout ) {
						clearTimeout( loadCheckTimeout );
					}

					// Try the next source
					tryNextSource( currentIndex + 1 );
				} );

				// Replace the old object with the new one
				currentObject.parentNode.replaceChild( newObject, currentObject );
			}

			// Handle error event on the initial object
			// This fires when the object tag fails to load
			pdfObject.addEventListener( 'error', function() {
				const currentIndex = parseInt( pdfObject.getAttribute( 'data-current-index' ) || '0', 10 );

				// Clear the load check timeout since we got an error
				if ( loadCheckTimeout ) {
					clearTimeout( loadCheckTimeout );
				}

				// Try the next source
				tryNextSource( currentIndex + 1 );
			} );

			// The first source (sources[0]) is already loaded by default via render.php
			// We don't need to check it proactively - just wait for error event
			// Set the current index
			pdfObject.setAttribute( 'data-current-index', '0' );
		} );
	}
} );
