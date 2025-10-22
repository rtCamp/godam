/**
 * Scroll to the top of the page
 *
 * @return {void}
 */
export const scrollToTop = () => {
	window.scrollTo( { top: 0, behavior: 'smooth' } );
};

/**
 * Check if the API key is valid
 */
export const hasValidAPIKey = window?.userData?.validApiKey || false;

/**
 * Masked API key
 */
export const maskedAPIKey = window?.userData?.userApiData?.masked_api_key || '';

/**
 * Check if the user is on the Starter plan
 */
export const isOnStarterPlan = window?.userData?.userApiData?.active_plan === 'Starter';

/**
 * GODAM API base URL
 */
export const GODAM_API_BASE = window?.godamSettings?.apiBase || '';

/**
 * Get max upload size in bytes.
 *
 * @param {string} [unit='byte'] Unit of measurement for the size. Options: 'byte', 'kb', 'mb', 'gb'.
 *
 * @return {number} Max upload size in bytes.
 */
export function getMaxUploadSize( unit = 'byte' ) {
	switch ( unit ) {
		case 'kb':
			return window?.goDAMUploadsData?.max_upload_size / 1024;
		case 'mb':
			return window?.goDAMUploadsData?.max_upload_size / ( 1024 * 1024 );
		case 'gb':
			return window?.goDAMUploadsData?.max_upload_size / ( 1024 * 1024 * 1024 );
		default:
			return window?.goDAMUploadsData?.max_upload_size;
	}
}

/**
 * Get the maximum upload size for Godam in bytes.
 *
 * @param {string} unit Unit of measurement for the size. Options: 'byte', 'kb', 'mb', 'gb'.
 * @return {number} The maximum upload size for Godam in the specified unit.
 */
export function getGodamMaxUploadSize( unit = 'byte' ) {
	switch ( unit ) {
		case 'kb':
			return window?.goDAMUploadsData?.godam_default_max_upload_size / 1024;
		case 'mb':
			return window?.goDAMUploadsData?.godam_default_max_upload_size / ( 1024 * 1024 );
		case 'gb':
			return window?.goDAMUploadsData?.godam_default_max_upload_size / ( 1024 * 1024 * 1024 );
		default:
			return window?.goDAMUploadsData?.godam_default_max_upload_size;
	}
}

/**
 * Format a file size in human readable format.
 *
 * @param {number} size The size in bytes.
 * @return {string} The formatted size string.
 */
export function formatSize( size ) {
	if ( size >= 1024 * 1024 * 1024 ) {
		return ( size / ( 1024 * 1024 * 1024 ) ).toFixed( 2 ) + ' GB';
	} else if ( size >= 1024 * 1024 ) {
		return ( size / ( 1024 * 1024 ) ).toFixed( 2 ) + ' MB';
	} else if ( size >= 1024 ) {
		return ( size / 1024 ).toFixed( 2 ) + ' KB';
	}
	return size + ' Bytes';
}

export function getMediaMigrationInfo() {
	// Fetch data from database or API.
	return window?.goDAMUploadsData?.media_migration_progress || {
		status: 'idle',
		remaining: 0,
		completed: 0,
		failed: 0,
		total: 0,
		total_size: 0,
		remaining_size: 0,
		migrating: {
			filename: '',
			size: 0,
		},
	};
}

/**
 * Utility function to check if the user has a valid API key.
 *
 * @return {boolean} True if the user has a valid API Key, false otherwise.
 */
export function isPremiumUser() {
	return !! window?.userData?.validApiKey;
}
