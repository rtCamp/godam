
/**
 * Most IDs the status route answers for in one request (Transcoding::MAX_STATUS_IDS).
 */
const MAX_IDS_PER_REQUEST = 100;

/**
 * How often to check a file waiting for an automatic retry, in milliseconds. The retry runs
 * from WP-Cron every 10 minutes, so once a minute is plenty.
 */
export const RETRYING_INTERVAL = 60000;

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

		// Files waiting for an automatic retry: still `failed`, so they'd stop being polled, but
		// they change on their own. Checked every RETRYING_INTERVAL instead of every tick.
		this.retryingIds = [];
		this.lastRetryingCheck = 0;
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

	async fetchStatus( now = Date.now() ) {
		try {
			const checkRetrying = this.retryingIds.length > 0 && now - this.lastRetryingCheck >= RETRYING_INTERVAL;
			const ids = checkRetrying ? [ ...this.postIds, ...this.retryingIds ] : this.postIds;

			if ( checkRetrying ) {
				this.lastRetryingCheck = now;
			}

			const data = await this.fetchBatches( ids );
			if ( ! data ) {
				return;
			}

			this.updateCallback( data );
			this.filterPostIds( data, ids, now );

			if ( this.postIds.length === 0 && this.retryingIds.length === 0 ) {
				this.stopPolling();
			}
		} catch ( error ) {
			throw error;
		}
	}

	/**
	 * Keep polling files still in progress, and move files waiting for an automatic retry to
	 * the slower check, until they're done or fail for good.
	 *
	 * @param {Object} data    Statuses keyed by ID.
	 * @param {Array}  checked IDs this request asked about. Defaults to the ones in progress.
	 * @param {number} now     Current time in milliseconds.
	 */
	filterPostIds( data, checked = this.postIds, now = Date.now() ) {
		const inProgress = [];
		const retrying = this.retryingIds.filter( ( id ) => ! checked.includes( id ) );

		checked.forEach( ( id ) => {
			const post = data[ id ];
			if ( ! post ) {
				return;
			}

			if ( 'retrying' === post.failure?.kind ) {
				if ( ! this.retryingIds.includes( id ) ) {
					// Wait a full interval before the first slow check.
					this.lastRetryingCheck = this.retryingIds.length ? this.lastRetryingCheck : now;
				}
				retrying.push( id );
				return;
			}

			if ( post.progress !== 100 && ! [ 'not_transcoding', 'failed', 'stalled' ].includes( post.status ) ) {
				inProgress.push( id );
			}
		} );

		this.postIds = [ ...new Set( inProgress ) ];
		this.retryingIds = [ ...new Set( retrying ) ];
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
