document.addEventListener( 'DOMContentLoaded', function() {
	const mediaItems = document.querySelectorAll( '.youzify-media-item' );

	mediaItems.forEach( function( item ) {
		const videoWrapper = item.querySelector( 'div.youzify-media-item-godam-video' );

		if ( ! videoWrapper ) {
			return;
		}

		const contentEl = item.querySelector( '.youzify-media-item-content' );

		if ( contentEl ) {
			contentEl.style.display = 'none';
		}

		const sourceLink = contentEl ? contentEl.querySelector( '.youzify-media-post-link' ) : null;
		const sourceAnchor = sourceLink ? sourceLink.closest( 'a' ) || sourceLink : null;
		const href = sourceAnchor ? sourceAnchor.getAttribute( 'href' ) : null;

		if ( href ) {
			const targetLink = videoWrapper.querySelector( '.youzify-media-post-link' );
			const targetAnchor = targetLink ? targetLink.closest( 'a' ) || targetLink : null;

			if ( targetAnchor ) {
				targetAnchor.setAttribute( 'href', href );
			}
		}
	} );
} );

