
/**
 * Most IDs the status route answers for in one request (Transcoding::MAX_STATUS_IDS).
 */
const MAX_IDS_PER_REQUEST = 100;

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

	/**
	 * Send the REST nonce, so the route knows the logged-in user (it adds Central's own
	 * wording for a refused job only for someone who can edit the file).
	 *
	 * @return {Object} fetch() options.
	 */
	requestOptions() {
		const nonce = window.transcoderSettings?.nonce;

		return nonce ? { headers: { 'X-WP-Nonce': nonce } } : {};
	}

	/**
	 * Fetch the status of every ID, in requests of at most MAX_IDS_PER_REQUEST.
	 *
	 * @param {Array} postIds Attachment IDs.
	 * @return {Promise<Object|null>} Statuses keyed by ID, or null when there is no valid ID.
	 */
	async fetchBatches( postIds ) {
		const validIds = postIds.map( ( id ) => parseInt( id ) ).filter( ( id ) => Number.isInteger( id ) && id > 0 );
		if ( validIds.length === 0 ) {
			return null;
		}

		const requests = [];
		for ( let start = 0; start < validIds.length; start += MAX_IDS_PER_REQUEST ) {
			const url = this.buildUrl( validIds.slice( start, start + MAX_IDS_PER_REQUEST ) );
			requests.push( fetch( url, this.requestOptions() ).then( ( response ) => response.json() ) );
		}

		return Object.assign( {}, ...( await Promise.all( requests ) ) );
	}

	async fetchStatusOnce( postIds ) {
		try {
			const data = await this.fetchBatches( postIds );
			if ( ! data ) {
				return;
			}
			this.updateCallback( data );
		} catch ( error ) {
			throw error;
		}
	}

	async fetchStatus() {
		try {
			const data = await this.fetchBatches( this.postIds );
			if ( ! data ) {
				return;
			}

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
