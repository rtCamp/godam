/* global transcoderSettings */

/**
 * Internal dependencies
 */
import TranscodingChecker from './transcoding-checker';

const icons = {

	check: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
				<path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd" />
			</svg>`,

	exclamation: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
					<path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" />
				</svg>`,
};

/**
 * Grid view transcoding status.
 */
class GridViewTranscodingStatus {
	constructor() {
		const transcodingStatus = document.querySelectorAll( '.transcoding-status--in-progress' );
		const postIds = Array.from( transcodingStatus ).map( ( status ) => parseInt( status.dataset.id ) );

		if ( postIds.length > 0 ) {
			this.checker = new TranscodingChecker( transcoderSettings.restUrl, this.updateCallback.bind( this ), postIds );
			this.checker.startPolling();
		}
	}

	updateCallback( data ) {
		Object.keys( data ).forEach( ( key ) => {
			this.updateAttachmentStatus( key, data[ key ] );
		} );
	}

	updateAttachmentStatus( attachmentId, data ) {
		const progress = data.progress;
		const status = data.status;
		const thumbnail = data.thumbnail;

		this.transcodingStatusElement = document.querySelector( `.transcoding-status[data-id="${ attachmentId }"]` );

		if ( ! this.transcodingStatusElement ) {
			return;
		}

		this.transcodingStatusLoader = this.transcodingStatusElement.querySelector( '.transcoding-status__loader' );
		this.transcodingStatusSVG = this.transcodingStatusLoader.querySelector( 'svg' );

		if ( progress === 100 ) {
			this.updateCompletedStatus();

			// If thumbnail is available, update the thumbnail image.
			if ( thumbnail ) {
				const imgElement = this.transcodingStatusElement.querySelector( 'img' );

				if ( imgElement ) {
					imgElement.src = thumbnail;
				}
			}
		}

		if ( status === 'failed' ) {
			this.updateFailedStatus();
		}

		if ( status === 'not_transcoding' ) {
			this.updateNotTranscodingStatus();
		}

		if ( progress < 100 ) {
			this.updateInProgressStatus( progress, status );
		}
	}

	updateCompletedStatus() {
		if ( this.transcodingStatusSVG ) {
			this.transcodingStatusSVG.remove();
		}

		this.transcodingStatusLoader.insertAdjacentHTML( 'beforeend', icons.check );

		this.transcodingStatusElement.classList.remove( 'transcoding-status--in-progress' );
		this.transcodingStatusElement.classList.add( 'transcoding-status--completed' );
		this.transcodingStatusLoader.style.removeProperty( '--status-text' );
	}

	updateFailedStatus() {
		if ( this.transcodingStatusSVG ) {
			this.transcodingStatusSVG.remove();
		}

		this.transcodingStatusLoader.insertAdjacentHTML( 'beforeend', icons.exclamation );

		this.transcodingStatusElement.classList.remove( 'transcoding-status--in-progress' );
		this.transcodingStatusElement.classList.add( 'transcoding-status--failed' );
		this.transcodingStatusLoader.style.removeProperty( '--status-text' );
	}

	updateNotTranscodingStatus() {
		if ( this.transcodingStatusSVG ) {
			this.transcodingStatusSVG.remove();
		}

		this.transcodingStatusLoader.insertAdjacentHTML( 'beforeend', icons.exclamation );

		this.transcodingStatusElement.classList.remove( 'transcoding-status--in-progress' );
		this.transcodingStatusElement.classList.add( 'transcoding-status--not-started' );
		this.transcodingStatusLoader.style.removeProperty( '--status-text' );
	}

	updateInProgressStatus( progress, status ) {
		const titleStatus = status.charAt( 0 ).toUpperCase() + status.slice( 1 );
		this.transcodingStatusLoader.style.setProperty( '--status-text', `"${ titleStatus }"` );

		const progressCircle = this.transcodingStatusSVG.querySelector( '.progress' );

		if ( ! progressCircle ) {
			return;
		}

		const radius = progressCircle.r.baseVal.value;
		const circumference = 2 * Math.PI * radius;
		const offset = circumference * ( 1 - ( progress / 100 ) );

		progressCircle.style.strokeDasharray = circumference;
		progressCircle.style.strokeDashoffset = offset;
	}

	reAttachEvent() {
		if ( this.checker ) {
			this.checker.stopPolling();
			this.checker = null;
		}

		const transcodingStatus = document.querySelectorAll( '.transcoding-status--in-progress' );

		const postIds = Array.from( transcodingStatus ).map( ( status ) => parseInt( status.dataset.id ) );

		if ( postIds.length > 0 ) {
			this.checker = new TranscodingChecker( transcoderSettings.restUrl, this.updateCallback.bind( this ), postIds );
			this.checker.startPolling();
		}
	}

	addAttachment( attachmentId ) {
		if ( this.checker ) {
			this.checker.postIds.push( parseInt( attachmentId ) );

			if ( ! this.checker.polling ) {
				this.checker.startPolling();
			}
		} else {
			this.checker = new TranscodingChecker( transcoderSettings.restUrl, this.updateCallback.bind( this ), [ attachmentId ] );
			this.checker.startPolling();
		}
	}
}

export default GridViewTranscodingStatus;
