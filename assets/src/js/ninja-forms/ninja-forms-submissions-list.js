document.addEventListener( 'DOMContentLoaded', () => {
	const processCells = () => {
		const list = document.querySelector( '#the-list' );

		if ( ! list ) {
			return;
		}

		list.querySelectorAll( '.nf-submissions-cell' ).forEach( ( cell ) => {
			// Prevent re-processing
			if ( cell && cell.dataset && cell.dataset.godamProcessed === '1' ) {
				return;
			}

			const text = cell.textContent.trim();

			if ( ( text.startsWith( 'http://' ) || text.startsWith( 'https://' ) ) && text.includes( '/wp-content/uploads/' ) ) {
				let url;

				try {
					url = new URL( text, window.location.origin );
				} catch ( e ) {
					// If the URL is invalid, do not transform the cell into a link.
					return;
				}

				// Only allow same-origin http(s) URLs.
				if ( ( url.protocol === 'http:' || url.protocol === 'https:' ) && url.origin === window.location.origin ) {
					const link = document.createElement( 'a' );
					link.href = url.href;
					link.target = '_blank';
					link.rel = 'noopener noreferrer';
					link.textContent = 'View Recording';

					cell.textContent = '';
					cell.appendChild( link );

					cell.dataset.godamProcessed = '1';
				}
			}
		} );
	};

	// Initial run
	processCells();

	const ninjaFormEntriesObserver = new MutationObserver( () => {
		processCells();
	} );

	ninjaFormEntriesObserver.observe( document.getElementById( 'nf-submissions-element' ), {
		childList: true,
		subtree: true,
	} );
} );
