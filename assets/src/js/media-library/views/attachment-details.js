/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { createAttachmentField, createTable } from './fields/compat-fields';
import renderMoveToFolderField from './fields/move-to-folder-field';

/**
 * Reference to the WordPress media Attachment Details view.
 *
 * @type {Object}
 */
const AttachmentDetails = wp?.media?.view?.Attachment?.Details;

/**
 * Checks if a given URL is an MPD (MPEG-DASH) file.
 *
 * @param {string} url - The URL to check.
 * @return {boolean} True if the URL ends with '.mpd', false otherwise.
 */
const isMpd = ( url ) => typeof url === 'string' && url.trim().toLowerCase().endsWith( '.mpd' );

/**
 * Checks if a given URL is an M3U8 (HLS) file.
 *
 * @param {string} url - The URL to check.
 * @return {boolean} True if the URL ends with '.m3u8', false otherwise.
 */
const isM3U8 = ( url ) => typeof url === 'string' && url.trim().toLowerCase().endsWith( '.m3u8' );

/**
 * AttachmentDetails extension used to add links to attachments selected from the GoDAM tab.
 * This component displays transcoded CDN URLs (MPD/HLS) for GoDAM attachments in the media modal.
 */
export default AttachmentDetails?.extend( {
	initialize() {
		AttachmentDetails.prototype.initialize.apply( this, arguments );
	},

	render() {
		AttachmentDetails.prototype.render.apply( this, arguments );

		// Before the early returns below: the folder control belongs on every
		// attachment, not just transcoded videos.
		renderMoveToFolderField( this );

		const mime = this.model.get( 'mime' );

		if ( mime && ! mime.startsWith( 'video/' ) ) {
			return this;
		}

		const hlsUrl = this.model.get( 'hls_url' );
		const mpdUrl = this.model.get( 'mpd_url' );
		const id = this.model.get( 'id' );
		const godamAPIBase = window?.godamRestRoute?.apiBase;
		let oEmbeddedVideoUrl = null;
		if ( godamAPIBase && id ) {
			oEmbeddedVideoUrl = godamAPIBase + '/web/video/' + id;
		}

		// Skip the local Media Library attachments.
		if ( ( ! mpdUrl || ! isMpd( mpdUrl ) ) && ( ! hlsUrl || ! isM3U8( hlsUrl ) ) ) {
			return this;
		}

		const attachmentId = this.model.get( 'id' );

		const tableBody = createTable( this.el );

		if ( oEmbeddedVideoUrl ) {
			tableBody.appendChild(
				createAttachmentField( {
					id: attachmentId,
					fieldName: 'oembed_video_url',
					fieldLabel: __( 'oEmbed Video URL', 'godam' ),
					url: oEmbeddedVideoUrl,
					helpText: __( 'The oEmbed URL can be used to embed the video in other platforms that support oEmbed.', 'godam' ),
				} ),
			);
		}

		if ( mpdUrl && isMpd( mpdUrl ) ) {
			tableBody.appendChild(
				createAttachmentField( {
					id: attachmentId,
					fieldName: 'transcoded_url',
					fieldLabel: __( 'Transcoded CDN URL (MPD)', 'godam' ),
					url: mpdUrl,
					helpText: __( 'The URL of the transcoded file is generated automatically and cannot be edited.', 'godam' ),
				} ),
			);
		}

		if ( hlsUrl && isM3U8( hlsUrl ) ) {
			tableBody.appendChild(
				createAttachmentField( {
					id: attachmentId,
					fieldName: 'hls_transcoded_url',
					fieldLabel: __( 'Transcoded CDN URL (HLS)', 'godam' ),
					url: hlsUrl,
					helpText: __( 'The HLS URL of the transcoded file is generated automatically and cannot be edited.', 'godam' ),
				} ),
			);
		}

		return this;
	},
} );
