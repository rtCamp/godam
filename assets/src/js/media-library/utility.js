/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
/**
 * Internal dependencies
 */
import Attachments from './models/attachments';

/* global _ */

/**
 * Utility function to check if the user has a valid API key.
 *
 * @return {boolean} True if the user has a valid API Key, false otherwise.
 */
function isAPIKeyValid() {
	return window.MediaLibrary?.userData?.validApiKey ? true : false;
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
	return ! window.easydamMediaLibrary?.enableFolderOrganization || false;
}

function addManageMediaButton() {
	const referenceElement = document.querySelector( '.wrap .page-title-action' );

	const godamMediaLink = window.godamRestRoute?.apiBase + '/web/media-library';
	const page = window.easydamMediaLibrary?.page || '';

	// Insert the button after referenceElement
	if ( referenceElement && 'upload' === page ) {
		const button = document.createElement( 'a' );
		button.className = 'button godam-button';
		button.href = godamMediaLink ?? '#';
		button.target = '_blank';
		if ( ! isAPIKeyValid() ) {
			button.classList.add( 'disable' );
			button.title = __( 'Premium Feature', 'godam' );
			button.href = '#';
			button.target = '';
		}
		const icon = document.createElement( 'span' );
		icon.classList.add( 'godam-icon' );
		button.appendChild( icon );
		const text = document.createElement( 'span' );
		text.className = 'button-text';
		text.textContent = __( 'Manage Media', 'godam' );
		button.appendChild( text );
		referenceElement.insertAdjacentElement( 'afterend', button );
	}
}

/**
 * Get an instance of our wp.media.model.Attachments extension
 *
 * @param {Object} props
 */
const getQuery = ( props ) => {
	return new Attachments( null, {
		props: _.extend( _.defaults( props || {}, {} ), { query: true } ),
	} );
};

/**
 * Helper function to fetch media settings.
 *
 * @return {Promise<Object | undefined>} A promise that resolves with the JSON response from the API, or undefined if the request fails.
 */
async function getGodamSettings() {
	const url = 'godam/v1/settings/godam-settings';

	try {
		const response = await wp.apiFetch( {
			path: url,
			method: 'GET',
		} );

		return response;
	} catch ( error ) {
	}
}

/**
 * Checks if the current user is allowed to manage this attachment.
 *
 * @param {number} attachmentAuthorId The ID of the attachment author.
 * @return {boolean} Returns true if the user can manage the attachment, false otherwise.
 */
function canManageAttachment( attachmentAuthorId ) {
	const currentUserId = Number( window?.easydamMediaLibrary?.userId );
	const canEditOthersMedia = window?.easydamMediaLibrary?.canEditOthersMedia;
	const __attachmentAuthorId = Number( attachmentAuthorId ) || 0;

	return canEditOthersMedia || currentUserId === __attachmentAuthorId;
}

/**
 * Checks if the current user is allowed to manage options.
 *
 * @return {boolean} Returns true if the user can manage options, false otherwise.
 */
function canManageOptions() {
	const _canManageOptions = window?.easydamMediaLibrary?.canManageOptions;

	return _canManageOptions;
}

export { isAPIKeyValid, checkMediaLibraryView, isUploadPage, isFolderOrgDisabled, addManageMediaButton, getQuery, getGodamSettings, canManageAttachment, canManageOptions };
