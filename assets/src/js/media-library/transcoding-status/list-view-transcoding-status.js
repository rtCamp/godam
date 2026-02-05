/* global transcoderSettings */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import TranscodingChecker from './transcoding-checker';

/**
 * SVG icons used for different transcoding states
 */
const ICONS = {
	check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
		<path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd" />
	</svg>`,

	exclamation: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
		<path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" />
	</svg>`,
};

/**
 * CSS class names for different transcoding states
 */
const STATUS_CLASSES = {
	IN_PROGRESS: 'transcoding-status--in-progress',
	COMPLETED: 'transcoding-status--completed',
	FAILED: 'transcoding-status--failed',
	NOT_STARTED: 'transcoding-status--not-started',
};

/**
 * Manages transcoding status display and updates in list view
 *
 * This class handles the real-time monitoring and visual updates of media transcoding
 * processes in a list view interface. It polls for status updates and dynamically
 * updates the UI to reflect current transcoding progress, completion, or failure states.
 */
class ListViewTranscodingStatus {
	/**
	 * Initialize the transcoding status manager
	 *
	 * Finds all transcoding status elements in the DOM, extracts their
	 * post IDs, and starts polling for status updates if any are found.
	 */
	constructor() {
		// Include all transcoding-status elements (including completed) to handle retranscoding scenarios
		const transcodingStatusElements = document.querySelectorAll( '.transcoding-status' );
		const postIds = Array.from( transcodingStatusElements ).map( ( status ) => parseInt( status.dataset.id ) );

		if ( postIds.length > 0 ) {
			this.checker = new TranscodingChecker(
				transcoderSettings.restUrl,
				this.updateCallback.bind( this ),
				postIds,
			);
			this.checker.startPolling();
		}
	}

	/**
	 * Callback function called when transcoding status data is received
	 *
	 * Iterates through the received data and updates each attachment's status
	 * display accordingly.
	 *
	 * @param {Object} data - Object containing attachment IDs as keys and status data as values
	 */
	updateCallback( data ) {
		Object.keys( data ).forEach( ( attachmentId ) => {
			this.updateAttachmentStatus( attachmentId, data[ attachmentId ] );
		} );
	}

	/**
	 * Update the visual status display for a specific attachment
	 *
	 * Handles all visual updates including status classes, icons, progress indicators,
	 * and status text based on the current transcoding state.
	 *
	 * @param {string} attachmentId  - The ID of the attachment to update
	 * @param {Object} data          - The status data containing progress, status, and message
	 * @param {string} data.status   - Current status ('failed', 'not_transcoding', etc.)
	 * @param {number} data.progress - Progress percentage (0-100)
	 * @param {string} data.message  - Status message to display
	 */
	updateAttachmentStatus( attachmentId, data ) {
		const element = document.querySelector( `#list-transcoder-status-${ attachmentId }` );
		if ( ! element ) {
			return;
		}

		const loader = element.querySelector( '.transcoding-status__loader' );

		// Skip virtual media - they have GoDAM logo and should always show as completed
		const isVirtual = !! loader.querySelector( 'img[alt*="GoDAM Logo"]' );
		if ( isVirtual ) {
			return;
		}

		const existingIcon = loader.querySelector( 'svg' );

		// Reset all status classes before applying new ones
		this._resetStatusClasses( element );

		const statusText = element.querySelector( '.status-text' );
		// Handle failed transcoding state
		if ( data.status === 'failed' ) {
			this._updateFailedStatus( element, loader, statusText, existingIcon );
			return;
		}

		// Handle not started transcoding state
		if ( data.status === 'not_transcoding' ) {
			this._updateNotStartedStatus( element, loader, statusText, existingIcon );
			return;
		}

		// Handle completed transcoding state
		if ( data.progress === 100 ) {
			this._updateCompletedStatus( element, loader, statusText, existingIcon );

			this._updateThumbnailIfAvailable( element, data.thumbnail );
			return;
		}

		// Handle in-progress transcoding state
		this._updateInProgressStatus( element, loader, statusText, data );
	}

	/**
	 * Update the circular progress indicator
	 *
	 * Calculates and applies the stroke-dashoffset to create a visual progress ring
	 * based on the current progress percentage.
	 *
	 * @param {HTMLElement} loader   - The loader element containing the progress circle
	 * @param {number}      progress - Progress percentage (0-100)
	 */
	updateProgress( loader, progress ) {
		if ( progress === null || typeof progress !== 'number' || progress < 0 || progress > 100 ) {
			return;
		}

		const circle = loader.querySelector( '.transcoding-status__loader__progress .progress' );
		if ( ! circle ) {
			return;
		}

		const radius = circle?.r?.baseVal?.value;
		const circumference = 2 * Math.PI * radius;

		circle.style.strokeDasharray = `${ circumference } ${ circumference }`;
		circle.style.strokeDashoffset = `${ ( ( 100 - progress ) / 100 ) * circumference }`;
	}

	/**
	 * Reset all status-related CSS classes from an element
	 *
	 * @private
	 * @param {HTMLElement} element - The element to reset classes on
	 */
	_resetStatusClasses( element ) {
		element.classList.remove(
			STATUS_CLASSES.IN_PROGRESS,
			STATUS_CLASSES.COMPLETED,
			STATUS_CLASSES.FAILED,
			STATUS_CLASSES.NOT_STARTED,
		);
	}

	/**
	 * Update element to show failed transcoding status
	 *
	 * @private
	 * @param {HTMLElement}      element      - The main status element
	 * @param {HTMLElement}      loader       - The loader element
	 * @param {HTMLElement}      statusText   - The status text element
	 * @param {HTMLElement|null} existingIcon - Any existing icon element to replace
	 */
	_updateFailedStatus( element, loader, statusText, existingIcon ) {
		element.classList.add( STATUS_CLASSES.FAILED );

		this._replaceIcon( loader, existingIcon, ICONS.exclamation );

		const failureMessage = __( 'Transcoding failed, please try again.', 'godam' );
		loader.style.setProperty( '--status-text', failureMessage );
		statusText.textContent = failureMessage;
	}

	/**
	 * Update element to show not started transcoding status
	 *
	 * @private
	 * @param {HTMLElement}      element      - The main status element
	 * @param {HTMLElement}      loader       - The loader element
	 * @param {HTMLElement}      statusText   - The status text element
	 * @param {HTMLElement|null} existingIcon - Any existing icon element to replace
	 */
	_updateNotStartedStatus( element, loader, statusText, existingIcon ) {
		element.classList.add( STATUS_CLASSES.NOT_STARTED );

		this._replaceIcon( loader, existingIcon, ICONS.exclamation );

		const notStartedMessage = __( 'Not started', 'godam' );
		loader.style.setProperty( '--status-text', notStartedMessage );
		statusText.textContent = notStartedMessage;
	}

	/**
	 * Update element to show completed transcoding status
	 *
	 * @private
	 * @param {HTMLElement}      element      - The main status element
	 * @param {HTMLElement}      loader       - The loader element
	 * @param {HTMLElement}      statusText   - The status text element
	 * @param {HTMLElement|null} existingIcon - Any existing icon element to replace
	 */
	_updateCompletedStatus( element, loader, statusText, existingIcon ) {
		element.classList.add( STATUS_CLASSES.COMPLETED );

		this._replaceIcon( loader, existingIcon, ICONS.check );

		loader.style.removeProperty( '--status-text' );
		statusText.textContent = __( 'Media is transcoded', 'godam' );
	}

	/**
	 * Update element to show in-progress transcoding status
	 *
	 * @private
	 * @param {HTMLElement} element    - The main status element
	 * @param {HTMLElement} loader     - The loader element
	 * @param {HTMLElement} statusText - The status text element
	 * @param {Object}      data       - The status data containing progress and message
	 */
	_updateInProgressStatus( element, loader, statusText, data ) {
		element.classList.add( STATUS_CLASSES.IN_PROGRESS );

		// Check if progress SVG exists, if not recreate it (for retranscoded items)
		const existingSVG = loader.querySelector( '.transcoding-status__loader__progress' );
		if ( ! existingSVG ) {
			// Remove any existing icons (checkmark, exclamation, etc.)
			const existingIcon = loader.querySelector( 'svg' );
			if ( existingIcon ) {
				existingIcon.remove();
			}

			// Recreate the progress bar SVG structure
			const progressSVG = `
				<svg class="transcoding-status__loader__progress" viewBox="0 0 36 36">
					<circle class="background" cx="18" cy="18" r="16" />
					<circle class="progress" cx="18" cy="18" r="16" />
				</svg>
			`;
			loader.insertAdjacentHTML( 'beforeend', progressSVG );
		}

		this.updateProgress( loader, data.progress );

		const progressMessage = `${ data.message || __( 'Transcoding…', 'godam' ) } (${ data.progress }%)`;
		statusText.textContent = progressMessage;
		loader.style.setProperty( '--status-text', progressMessage );
	}

	/**
	 * Replace an existing icon with a new one
	 *
	 * @private
	 * @param {HTMLElement}      loader       - The loader element to add the icon to
	 * @param {HTMLElement|null} existingIcon - The existing icon to remove
	 * @param {string}           newIconHTML  - The HTML string for the new icon
	 */
	_replaceIcon( loader, existingIcon, newIconHTML ) {
		if ( existingIcon ) {
			existingIcon.remove();
		}
		loader.insertAdjacentHTML( 'beforeend', newIconHTML );
	}

	/**
	 * Update the thumbnail image if a new thumbnail URL is provided
	 *
	 * @param {HTMLElement} element   - The main status element containing the thumbnail
	 * @param {string}      thumbnail - The URL of the new thumbnail image
	 */
	_updateThumbnailIfAvailable( element, thumbnail ) {
		if ( thumbnail ) {
			// get parent with `has-row-actions` class
			const parent = element.closest( 'tr' );
			const imgElement = parent.querySelector( '.has-media-icon img' );

			if ( imgElement ) {
				imgElement.src = thumbnail;

				// manually add style attribute for the image.
				imgElement.style.height = '60px';
				imgElement.style.objectFit = 'cover';
			}
		}
	}
}

export default ListViewTranscodingStatus;
