/**
 * AB Test Manager for Godam Video Player
 * Handles A/B testing functionality for video thumbnails
 */
class ABTestManager {
	constructor( player ) {
		this.key = 'godam_ab_testing';
		this.data = {};
		this.logger = new Logger( 'ABTestManager' );
		this.player = player;
	}

	/**
	 * Initialize A/B test for a video
	 *
	 * @param {Object} video             - Video element
	 * @param {Object} videoSetupOptions - Video setup configuration
	 */
	initializeTest( video, videoSetupOptions ) {
		const jobId = this.getJobId( video );
		const isEnabled = this.isTestEnabled( videoSetupOptions );

		if ( ! jobId ) {
			this.logger.log( 'Skipping A/B test - jobId check failed', { isEnabled } );
			return;
		}

		// If the test is disabled, remove 'jobId' from storage if present and return early
		if ( ! isEnabled ) {
			const data = this.loadStoredData();
			if ( data.hasOwnProperty( jobId ) ) {
				delete data[ jobId ];

				if ( Object.keys( data ).length === 0 ) {
					// If data object is empty after deletion, remove the whole localStorage key
					localStorage.removeItem( this.key );
					this.logger.log(
						`A/B test disabled - all test data removed (empty)`,
					);
				} else {
					// Otherwise, save updated data without the jobId
					this.saveData( data );
					this.logger.log(
						`A/B test disabled - removed test for jobId: ${ jobId }`,
					);
				}
			}
			return;
		}

		const testParams = this.getTestParams( videoSetupOptions );
		if ( ! this.isValidTestParams( testParams ) ) {
			this.logger.log( 'Invalid test parameters', testParams );
			return;
		}

		this.processTest( jobId, testParams );
	}

	/**
	 * Get job ID from video element
	 *
	 * @param {Object} video - Video element
	 * @return {string|undefined}
	 */
	getJobId( video ) {
		return video.dataset?.job_id;
	}

	/**
	 * Check if A/B test is enabled
	 *
	 * @param {Object} videoSetupOptions - Video setup configuration
	 * @return {boolean}
	 */
	isTestEnabled( videoSetupOptions ) {
		return videoSetupOptions.abTestParams?.isEnabled === '1';
	}

	/**
	 * Get test parameters
	 *
	 * @param {Object} videoSetupOptions - Video setup configuration
	 * @return {Object}
	 */
	getTestParams( videoSetupOptions ) {
		return {
			thumbnails: videoSetupOptions.abTestParams?.thumbnailsSelected || [],
			expiryTime: videoSetupOptions.abTestParams?.endTime,
			maxIndex: videoSetupOptions.abTestParams?.thumbnailsSelected?.length || 0,
		};
	}

	/**
	 * Validate test parameters
	 *
	 * @param {Object} params - Test parameters
	 * @return {boolean}
	 */
	isValidTestParams( params ) {
		return params.thumbnails.length > 0 && params.expiryTime && params.maxIndex > 0;
	}

	/**
	 * Process the A/B test logic
	 *
	 * @param {string} jobId      - Job identifier
	 * @param {Object} testParams - Test parameters
	 */
	processTest( jobId, testParams ) {
		try {
			const storedData = this.loadStoredData();
			const now = new Date();
			const expiryTime = this.parseExpiryTime( testParams.expiryTime );

			if ( now > expiryTime ) {
				this.handleExpiredTest( jobId, storedData );
				return;
			}

			const testValue = this.getOrCreateTestValue( jobId, testParams.maxIndex, storedData );
			this.updatePosterImage( testValue, testParams.thumbnails );
		} catch ( error ) {
			this.logger.error( 'Error processing A/B test', error );
			this.resetStorage();
		}
	}

	/**
	 * Load stored data from localStorage
	 *
	 * @return {Object}
	 */
	loadStoredData() {
		try {
			const stored = localStorage.getItem( this.key );
			return stored ? JSON.parse( stored ) : {};
		} catch ( error ) {
			this.logger.error( 'Error loading stored data', error );
			return {};
		}
	}

	/**
	 * Parse expiry time string
	 *
	 * @param {string} expiryTimeStr - Expiry time string
	 * @return {Date}
	 */
	parseExpiryTime( expiryTimeStr ) {
		const normalized = expiryTimeStr.replace(
			/(\d{2}):(\d{2}):(\d{2})(am|pm)/i,
			( match, h, m, s, ampm ) => {
				let hours = parseInt( h, 10 );
				if ( ampm.toLowerCase() === 'pm' && hours < 12 ) {
					hours += 12;
				}
				if ( ampm.toLowerCase() === 'am' && hours === 12 ) {
					hours = 0;
				}
				return `${ String( hours ).padStart( 2, '0' ) }:${ m }:${ s }`;
			},
		);
		return new Date( normalized );
	}

	/**
	 * Handle expired test
	 *
	 * @param {string} jobId - Job identifier
	 * @param {Object} data  - Current data
	 */
	handleExpiredTest( jobId, data ) {
		if ( data.hasOwnProperty( jobId ) ) {
			delete data[ jobId ];
			this.logger.log( `AB test expired for jobId: ${ jobId }` );

			if ( Object.keys( data ).length === 0 ) {
				localStorage.removeItem( this.key );
				this.logger.log( 'All AB test data removed - empty object' );
			} else {
				this.saveData( data );
			}
		}
	}

	/**
	 * Get existing test value or create new one
	 *
	 * @param {string} jobId    - Job identifier
	 * @param {number} maxIndex - Maximum index value
	 * @param {Object} data     - Current data
	 * @return {number}
	 */
	getOrCreateTestValue( jobId, maxIndex, data ) {
		if ( ! data.hasOwnProperty( jobId ) ) {
			data[ jobId ] = Math.floor( Math.random() * maxIndex );
			this.saveData( data );
			this.logger.log( `New AB test value set for ${ jobId }: ${ data[ jobId ] }` );
		} else {
			this.logger.log( `Existing AB test value for ${ jobId }: ${ data[ jobId ] }` );
		}
		return data[ jobId ];
	}

	/**
	 * Update poster image with test thumbnail
	 *
	 * @param {number} index      - Thumbnail index
	 * @param {Array}  thumbnails - Available thumbnails
	 */
	updatePosterImage( index, thumbnails ) {
		const posterContainer = this.player.el_.querySelector( '.vjs-poster' );
		if ( ! posterContainer ) {
			return;
		}

		const img = posterContainer.querySelector( 'img' );
		if ( img && thumbnails[ index ] ) {
			img.src = thumbnails[ index ];
			this.logger.log( `Updated poster image to thumbnail ${ index }` );
		}
	}

	/**
	 * Save data to localStorage
	 *
	 * @param {Object} data - Data to save
	 */
	saveData( data ) {
		try {
			localStorage.setItem( this.key, JSON.stringify( data ) );
		} catch ( error ) {
			this.logger.error( 'Error saving data', error );
		}
	}

	/**
	 * Reset storage (remove all data)
	 */
	resetStorage() {
		try {
			localStorage.removeItem( this.key );
			this.logger.log( 'Storage reset' );
		} catch ( error ) {
			this.logger.error( 'Error resetting storage', error );
		}
	}

	/**
	 * Get all test data
	 *
	 * @return {Object}
	 */
	getAllData() {
		return this.loadStoredData();
	}

	/**
	 * Get test value for specific job
	 *
	 * @param {string} jobId - Job identifier
	 * @return {number|undefined}
	 */
	getTestValue( jobId ) {
		const data = this.loadStoredData();
		return data[ jobId ];
	}

	/**
	 * Remove test for specific job
	 *
	 * @param {string} jobId - Job identifier
	 */
	removeTest( jobId ) {
		const data = this.loadStoredData();
		if ( data.hasOwnProperty( jobId ) ) {
			delete data[ jobId ];
			this.saveData( data );
			this.logger.log( `Removed test for jobId: ${ jobId }` );
		}
	}
}

/**
 * Simple logger utility
 */
class Logger {
	constructor( name ) {
		this.name = name;
	}

	log( message, data = null ) {
		console.log( `[${ this.name }] ${ message }`, data || '' );
	}

	error( message, error = null ) {
		console.error( `[${ this.name }] ${ message }`, error || '' );
	}
}

// Export for use in other modules
if ( typeof module !== 'undefined' && module.exports ) {
	module.exports = { ABTestManager, Logger };
} else if ( typeof window !== 'undefined' ) {
	window.ABTestManager = ABTestManager;
	window.Logger = Logger;
}
