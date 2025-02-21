/**
 * Utility function to check if the user has a valid license.
 *
 * @return {boolean} True if the user has a valid license, false otherwise.
 */
function isLicenseValid() {
	return window.MediaLibrary?.userData?.valid_license ? true : false;
}

/**
 * Check the current view of the media library.
 *
 * @return {string} 'list' or 'grid'.
 */
function checkMediaLibraryView() {
	const anchorTag = document.querySelector( '.wp-filter .filter-items .view-switch a.current' );

	if ( anchorTag && anchorTag.id === 'view-switch-list' ) {
		return 'list';
	}

	return 'grid';
}

export { isLicenseValid, checkMediaLibraryView };
