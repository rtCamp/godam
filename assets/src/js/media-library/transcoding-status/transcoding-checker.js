
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
		if ( ! url ) {
			return;
		}
		try {
			const response = await fetch( url );
			const data = await response.json();
			this.updateCallback( data );
		} catch ( error ) {
			throw error;
		}
	}

	async fetchStatus() {
		const url = this.buildUrl( this.postIds );
		if ( ! url ) {
			return;
		}

		try {
			const response = await fetch( url );
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
			if ( ! post ) {
				return false;
			}
			return post.progress !== 100 && post.status !== 'not_transcoding' && post.status !== 'failed';
		} );
	}

	buildUrl( postIds ) {
		// convert string IDs to int here. and filter out the invalid IDs.
		postIds = postIds.map( ( id ) => parseInt( id ) );
		const validIds = postIds.filter( ( id ) => Number.isInteger( id ) && id > 0 );
		if ( validIds.length === 0 ) {
			return null;
		}

		const queryString = validIds.map( ( id ) => `ids[]=${ id }` ).join( '&' );
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
