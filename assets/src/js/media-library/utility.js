/**
 * Utility function to check if the user has a valid license.
 *
 * @return {boolean} True if the user has a valid license, false otherwise.
 */
function isLicenseValid() {
	return window.MediaLibrary?.userData?.valid_api_key ? true : false;
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

/**
 * Check if in the upload page.
 *
 * @return {boolean} True if in the upload page, false otherwise.
 */
function isUploadPage() {
	return document.querySelector( '.upload-php' ) ? true : false;
}

/**
 * Check if folder organization is disabled.
 *
 * @return {boolean} True if folder organization is disabled, false otherwise.
 */
function isFolderOrgDisabled() {
	return window.easydamMediaLibrary?.disableFolderOrganization || false;
}

export { isLicenseValid, checkMediaLibraryView, isUploadPage, isFolderOrgDisabled };
