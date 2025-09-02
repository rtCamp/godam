/**
 * External dependencies
 */
import videojs from 'video.js';
import 'videojs-contrib-quality-menu';
import 'videojs-flvjs-es6';

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
 * Creates and initializes a Video.js player inside a given container.
 *
 * @param {HTMLElement} container             - The DOM element to inject the player into.
 * @param {Object}      options               - Options for the player.
 * @param {string}      options.videoId       - Unique ID for the video element.
 * @param {Array}       options.sources       - Array of source objects: [{src, type}]
 * @param {Object}      options.playerOptions - Video.js player options.
 */
function createVideoJsPlayer( container, { videoId, sources, playerOptions = {} } ) {
	if ( ! container ) {
		return;
	}

	// Hide default WP MediaElement player if present
	const mediaElementPlayer = container.querySelector( '.mejs-container' );
	if ( mediaElementPlayer ) {
		mediaElementPlayer.style.display = 'none'; // Hide default player. Only hide to avoid console errors for parts dependent on it.
	}

	// Build video HTML
	const videoHtml = `
        <video
            id="${ videoId }"
            class="video-js vjs-default-skin vjs-big-play-centered vjs-styles-dimensions"
            controls
            preload="auto"
            width="100%"
            height="auto"
        >
            ${ sources.map( ( source ) => `<source src="${ source.src }" type="${ source.type }" />` ).join( '\n' ) }
        </video>
    `;
	container.insertAdjacentHTML( 'beforeend', videoHtml );

	// Initialize Video.js player
	setTimeout( () => {
		const videoElement = document.getElementById( videoId );
		if ( videoElement && typeof videojs !== 'undefined' ) {
			videojs( videoElement, {
				width: '100%',
				aspectRatio: '16:9',
				controlBar: {
					volumePanel: true,
					fullscreenToggle: true,
					currentTimeDisplay: true,
					timeDivider: true,
					durationDisplay: true,
					remainingTimeDisplay: true,
					progressControl: true,
					playToggle: true,
					captionsButton: false,
					chaptersButton: false,
					pictureInPictureToggle: false,
					...( playerOptions.controlBar || {} ),
				},
				...playerOptions,
			} ).ready( function() {
				if ( typeof this.qualityMenu === 'function' ) {
					this.qualityMenu();
				}
			} );
		}
	}, 100 );
}

export { isAPIKeyValid, checkMediaLibraryView, isUploadPage, isFolderOrgDisabled, addManageMediaButton, getQuery, getGodamSettings, canManageAttachment, createVideoJsPlayer };
