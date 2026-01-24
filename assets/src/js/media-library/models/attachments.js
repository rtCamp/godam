/* global jQuery, _, Backbone, jqXHR */
/**
 * Custom Collection model of DAM (GoDAM) Attachments for WordPress Media Library.
 *
 * This code defines a custom query and collection logic for interacting with a custom
 * media endpoint provided by the GoDAM plugin. It integrates with the WordPress Media
 * Library modal and supports infinite scrolling, pagination, and custom fetching logic.
 */

/**
 * Extended Attachments Collection to override the default `_requery` behavior.
 * It mirrors the query with a custom query model (`wp.media.godamQuery`).
 */
const Attachments = wp?.media?.model?.Attachments.extend( {
	/**
	 * Custom requery method to fetch updated attachments when properties change.
	 *
	 * @param {Backbone.Model} props - Props model containing query parameters.
	 */
	_requery( props ) {
		if ( props && props.get( 'query' ) ) {
			// Invoke built-in mirror with our own query.
			const queryProps = props.toJSON();
			const query = wp.media.godamQuery.get( queryProps );
			this.mirror( query );
		}
	},

	/**
	 * Whether more results are available.
	 * Delegates to the mirrored GODAMAttachmentCollection.
	 *
	 * @return {boolean} Whether more results are available.
	 */
	hasMore() {
		return this.mirroring ? this.mirroring.hasMore() : false;
	},

	/**
	 * Fetch more attachments from the server.
	 * Delegates to the mirrored GODAMAttachmentCollection.
	 *
	 * @param {Object} options
	 * @return {Promise} A promise to the attachment api.
	 */
	more( options ) {
		const deferred = jQuery.Deferred();
		const mirroring = this.mirroring;
		const attachments = this;

		if ( ! mirroring || ! mirroring.more ) {
			return deferred.resolveWith( this ).promise();
		}

		mirroring.more( options ).done( function() {
			deferred.resolveWith( attachments );
			// Used for the search results.
			attachments.trigger( 'attachments:received', attachments );
		} );

		return deferred.promise();
	},
} );

/**
 * Custom Query model to handle fetching DAM (GoDAM) media items from a custom REST endpoint.
 * This class mimics the native `wp.media.model.Query` but is wired to a different backend source.
 */
const GODAMAttachmentCollection = wp?.media?.model?.Query?.extend(
	{
		/**
		 * Initialize the custom query with pagination variables.
		 */
		initialize() {
			// Call parent initialize method.
			wp.media.model.Query.prototype.initialize.apply( this, arguments );

			// Initialize instance-specific properties.
			this._hasMore = true;
			this._page = 1;
			this._perPage = 40;
			this.total = 0;
			this.totalAttachments = 0;
		},

		/**
		 * Whether more results are available for pagination.
		 *
		 * @return {boolean} If more results available.
		 */
		hasMore() {
			return !! this._hasMore;
		},

		/**
		 * Load more attachments (for infinite scroll).
		 *
		 * @param {Object} options - Options passed to fetch.
		 * @return {Promise} A promise to the attachment api.
		 */
		more( options = {} ) {
			// Avoid duplicate fetches
			if ( this._more && this._more.state() === 'pending' ) {
				return this._more;
			}

			if ( ! this.hasMore() ) {
				return jQuery.Deferred().resolveWith( this ).promise();
			}

			options.remove = false;

			// Trigger fetch and update internal state
			return ( this._more = this.fetch( options ) );
		},

		/**
		 * Override the sync method to fetch attachments from GoDAM API.
		 *
		 * @param {string}         method  - Backbone method (only 'read' expected).
		 * @param {Backbone.Model} model   - The model instance.
		 * @param {Object}         options - AJAX options.
		 * @return {jqXHR} A jQuery XMLHttpRequest (jqXHR) promise that resolves with the fetched media items.
		 */
		sync( method, model, options = {} ) {
			const perPage = this._perPage;
			const page = this._page;
			const requestData = {
				page,
				per_page: perPage,
				...( this.props?.get( 'search' ) && { search: this.props.get( 'search' ) } ),
				...( this.props?.get( 'type' ) && { type: this.props.get( 'type' ) } ),
			};

			// Perform AJAX fetch to custom endpoint.
			return jQuery.ajax( {
				url: window.godamTabCallback.apiUrl,
				method: 'GET',
				data: requestData,
				beforeSend( xhr ) {
					xhr.setRequestHeader( 'X-WP-Nonce', window.godamTabCallback.nonce );
				},
				success: ( response ) => {
					if ( response.success && Array.isArray( response?.data ) ) {
						const items = response.data;

						// Update pagination state - stop loading if no more results or empty response.
						this._hasMore = !! response.has_more && items.length > 0;

						// Increment page counter only on successful response with items.
						if ( items.length > 0 ) {
							this._page++;
						}

						// Update total counts.
						this.total = parseInt( response.total_items, 10 ) || 0;
						this.totalAttachments = this.length + items.length;

						// Call success callback with items - this resolves the promise.
						options.success?.( items );

						return items;
					}

					this._hasMore = false;
					this.total = 0;
					options.error?.( response );
				},
				error: ( xhr ) => {
					this._hasMore = false;
					options.error?.( xhr );
				},
			} );
		},

	},

	/**
	 * Static method to generate new GoDAM queries.
	 */
	{
		/**
		 * Create and return a new instance of the GODAMAttachmentCollection.
		 *
		 * @param {Object} props   - Props for the query (e.g., type).
		 * @param {Object} options - Additional options to pass to the collection.
		 * @return {GODAMAttachmentCollection}
		 */
		get: ( () => {
			const queries = [];

			return function( props = {}, options = {} ) {
				delete props.query;
				_.defaults( props );

				// Check if we already have a query with these props to prevent redundant instances.
				let query = _.find( queries, ( q ) => {
					return _.isEqual( q.props.toJSON(), props );
				} );

				if ( ! query ) {
					query = new wp.media.godamQuery( [], {
						props,
						args: {},
						...options,
					} );
					queries.push( query );

					// Initialize internal pagination state only for newly created queries.
					if ( typeof query._page !== 'undefined' ) {
						query._page = 1;
					}
					if ( typeof query._hasMore !== 'undefined' ) {
						query._hasMore = true;
					}
					if ( typeof query.reset === 'function' ) {
						query.reset();
					}
				}

				return query;
			};
		} )(),
	},
);

// Assign the custom query to global `wp.media` namespace.
if ( wp?.media ) {
	wp.media.godamQuery = GODAMAttachmentCollection;
}

export default Attachments;
