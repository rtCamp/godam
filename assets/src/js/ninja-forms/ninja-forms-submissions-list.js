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
				const link = document.createElement( 'a' );
				link.href = text;
				link.target = '_blank';
				link.rel = 'noopener noreferrer';
				link.textContent = 'View Recording';

				cell.textContent = '';
				cell.appendChild( link );

				cell.dataset.godamProcessed = '1';
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
