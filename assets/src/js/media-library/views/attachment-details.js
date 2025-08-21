const AttachmentDetails = wp?.media?.view?.Attachment?.Details;

export default AttachmentDetails?.extend( {

	initialize() {
		AttachmentDetails.prototype.initialize.apply( this, arguments );
	},

	render() {
		AttachmentDetails.prototype.render.apply( this, arguments );

		const hlsUrl = this.model.get( 'hls_url' );
		const mpdUrl = this.model.get( 'url' );

		const isMpd = ( url ) => typeof url === 'string' && url.trim().toLowerCase().endsWith( '.mpd' );
		const isM3U8 = ( url ) => typeof url === 'string' && url.trim().toLowerCase().endsWith( '.m3u8' );

		if ( ( mpdUrl && isMpd( mpdUrl ) ) || ( hlsUrl && isM3U8( hlsUrl ) ) ) {
			// Prefer the raw DOM element; fall back to jQuery wrapped element if necessary
			const container = this.el || ( this.$el && this.$el[ 0 ] );

			if ( mpdUrl && isMpd( mpdUrl ) && container ) {
				const wrapper = document.createElement( 'div' );
				wrapper.className = 'godam-transcoded-url';

				const label = document.createElement( 'strong' );
				label.textContent = 'MPD:';
				wrapper.appendChild( label );

				wrapper.appendChild( document.createTextNode( ' ' ) );

				const link = document.createElement( 'a' );
				link.href = mpdUrl;
				link.target = '_blank';
				link.rel = 'noopener noreferrer';
				link.textContent = mpdUrl;
				wrapper.appendChild( link );

				container.appendChild( wrapper );
			}

			if ( hlsUrl && isM3U8( hlsUrl ) && container ) {
				const wrapper = document.createElement( 'div' );
				wrapper.className = 'godam-transcoded-url';

				const label = document.createElement( 'strong' );
				label.textContent = 'HLS:';
				wrapper.appendChild( label );

				wrapper.appendChild( document.createTextNode( ' ' ) );

				const link = document.createElement( 'a' );
				link.href = hlsUrl;
				link.target = '_blank';
				link.rel = 'noopener noreferrer';
				link.textContent = hlsUrl;
				wrapper.appendChild( link );

				container.appendChild( wrapper );
			}
		}

		return this;
	},
} );
