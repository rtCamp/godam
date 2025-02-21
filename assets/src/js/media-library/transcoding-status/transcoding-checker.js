
/**
 * Class to check the Transcoding status from API.
 */
class TranscodingChecker {
	constructor( apiUrl, updateCallback, postIds = [], interval = 5000 ) {
		this.apiUrl = apiUrl;
		this.updateCallback = updateCallback;
		this.postIds = postIds;
		this.interval = interval;

		this.polling = null;
	}

	async fetchStatusOnce( postIds ) {
		const url = this.buildUrl( postIds );
		try {
			const response = await fetch( url );
			const data = await response.json();
			this.updateCallback( data );
		} catch ( error ) {
			throw error;
		}
	}

	async fetchStatus() {
		try {
			const response = await fetch( this.buildUrl( this.postIds ) );

			const data = await response.json();

			this.updateCallback( data );
			this.filterPostIds( data );

			if ( this.postIds.length === 0 ) {
				this.stopPolling();
			}
		} catch ( error ) {
			throw error;
		}
	}

	filterPostIds( data ) {
		this.postIds = this.postIds.filter( ( id ) => {
			const post = data[ id ];
			return post.progress !== 100 && post.status !== 'not_transcoding' && post.status !== 'failed';
		} );
	}

	buildUrl( postIds ) {
		const queryString = postIds.map( ( id ) => `ids[]=${ id }` ).join( '&' );
		return `${ this.apiUrl }?${ queryString }`;
	}

	startPolling() {
		if ( this.polling ) {
			return;
		}
		this.fetchStatus();
		this.polling = setInterval( () => this.fetchStatus(), this.interval );
	}

	stopPolling() {
		if ( this.polling ) {
			clearInterval( this.polling );
			this.polling = null;
		}
	}
}

export default TranscodingChecker;
