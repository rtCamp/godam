/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import Attachments from './models/attachments';
import { isSupportedDocument } from '../../blocks/godam-pdf/constants.js';

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
 * This is GoDAM's media-library integration kill-switch: when disabled (additive mode),
 * GoDAM's WordPress media-library takeover — folder sidebar, "Manage Media" button, search
 * override, attachment-browser folder/date filters — is suppressed so GoDAM can coexist with
 * another media/DAM plugin. The GoDAM media-modal tab, blocks, the player, and transcoding
 * are unaffected.
 *
 * @return {boolean} True if folder organization is disabled, false otherwise.
 */
function isFolderOrgDisabled() {
	return ! window.easydamMediaLibrary?.enableFolderOrganization || false;
}

/**
 * Whether GoDAM should replace WordPress's attachment browser and grid views
 * (`wp.media.view.AttachmentsBrowser` and `wp.media.view.Attachments`).
 *
 * Those replacements are what carry the grid-view transcoding UI — the status
 * badges and the "Transcode Media" (retranscode) bulk action — but they also bring
 * GoDAM's column-width logic and custom attachment view, so this gates more than
 * transcoding alone.
 *
 * Transcoding is a core GoDAM feature, not a folder-organization one, so the
 * replacements stay in place on the media library grid page (upload.php) even in
 * additive mode (folder organization disabled). Everywhere else in additive mode
 * (e.g. the media modal opened from a post) they are suppressed, since the browser
 * and grid views are the main clash surface with another media/DAM plugin. The
 * folder-only behaviour they contain is separately gated on `isFolderOrgDisabled()`.
 *
 * @return {boolean} True if GoDAM's browser/grid views should replace the native ones.
 */
function shouldReplaceAttachmentsViews() {
	return ! isFolderOrgDisabled() || isUploadPage();
}

async function addManageMediaButton() {
	const referenceElement = document.querySelector( '.wrap .page-title-action' );

	const godamMediaLink = window.godamRestRoute?.apiBase + '/web/media-library';
	const page = window.easydamMediaLibrary?.page || '';

	// Insert the button after referenceElement
	if ( referenceElement && 'upload' === page ) {
		const button = document.createElement( 'a' );
		button.className = 'button godam-button';
		button.href = godamMediaLink ?? '#';
		button.target = '_blank';
		const icon = document.createElement( 'span' );
		icon.classList.add( 'godam-icon' );
		button.appendChild( icon );
		const text = document.createElement( 'span' );
		text.className = 'button-text';
		text.textContent = __( 'Manage Media', 'godam' );
		button.appendChild( text );
		referenceElement.insertAdjacentElement( 'afterend', button );
		if ( ! isAPIKeyValid() ) {
			button.classList.add( 'disable' );
			button.title = __( 'Premium Feature', 'godam' );
			button.href = '#';
			button.target = '';
			return;
		}

		try {
			const response = await fetch(
				window.godamRestRoute?.url + 'godam/v1/site/site-data',
				{
					headers: {
						'Content-Type': 'application/json',
						'X-WP-Nonce': window.wpApiSettings.nonce,
					},
				} );
			const result = await response.json();
			if ( 'success' === result?.status && false !== result?.data && null !== result?.data?.message?.folder_id ) {
				const mediaUrl = `${ godamMediaLink }?page=1&viewMode=grid&tab=Folder&folder=${ result?.data?.message?.folder_id }`;
				button.href = mediaUrl;
			}
		} catch ( error ) {
			throw new Error( 'Error fetching media link:', error );
		}
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
		const response = await apiFetch( {
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

/**
 * Checks if the current user is allowed to edit pages.
 *
 * @return {boolean} Returns true if the user can edit pages, false otherwise.
 */
function canEditPages() {
	const _canEditPages = window?.easydamMediaLibrary?.canEditPages;

	return _canEditPages;
}

/**
 * Whether a media-library model is a document GoDAM converts to a previewable PDF.
 *
 * The model's `type` is only the first half of the MIME type — 'application' for a .docx,
 * 'text' for a .txt — so it has to be recombined with `subtype` before it says anything. The
 * file name is checked as well, because text/plain covers .srt/.asc/.c/.cc/.h alongside .txt
 * and those are never transcoded; that is the same pair of conditions
 * rtgodam_is_supported_document_attachment() applies server-side.
 *
 * @param {Object} model Backbone attachment model.
 * @return {boolean} True when the attachment is a convertible document.
 */
function isDocumentModel( model ) {
	if ( ! model ) {
		return false;
	}

	return isSupportedDocument( {
		mime: `${ model.get( 'type' ) }/${ model.get( 'subtype' ) }`,
		filename: model.get( 'filename' ) || '',
	} );
}

export { isAPIKeyValid, isDocumentModel, checkMediaLibraryView, isUploadPage, isFolderOrgDisabled, shouldReplaceAttachmentsViews, addManageMediaButton, getQuery, getGodamSettings, canManageAttachment, canManageOptions, canEditPages };
