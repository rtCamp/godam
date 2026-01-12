/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

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
 * Creates a table row element representing an attachment field.
 *
 * @param {Object}        params            - The parameters for the field.
 * @param {number|string} params.id         - The attachment ID.
 * @param {string}        params.fieldName  - The name of the field.
 * @param {string}        params.fieldLabel - The label for the field.
 * @param {string}        params.url        - The URL value for the field.
 * @param {string}        params.helpText   - The help text to display under the field.
 * @return {HTMLElement} The constructed table row element.
 */
const createAttachmentField = ( { id, fieldName, fieldLabel, url, helpText } ) => {
	const tr = document.createElement( 'tr' );
	tr.className = `compat-field-${ fieldName }`;

	const th = document.createElement( 'th' );
	th.scope = 'row';
	th.className = 'label';

	const label = document.createElement( 'label' );
	label.htmlFor = `attachments-${ id }-${ fieldName }`;

	const span = document.createElement( 'span' );
	span.className = 'alignleft';
	span.textContent = fieldLabel;
	label.appendChild( span );

	label.appendChild( document.createElement( 'br' ) );
	label.querySelector( 'br' ).className = 'clear';

	th.appendChild( label );
	tr.appendChild( th );

	const td = document.createElement( 'td' );
	td.className = 'field';

	const input = document.createElement( 'input' );
	input.type = 'text';
	input.className = 'widefat';
	input.name = `attachments[${ id }][${ fieldName }]`;
	input.id = `attachments-${ id }-${ fieldName }`;
	input.value = url;
	input.readOnly = true;
	td.appendChild( input );

	const p = document.createElement( 'p' );
	p.className = 'help';
	p.textContent = helpText;
	td.appendChild( p );

	tr.appendChild( td );

	return tr;
};

/**
 * Creates a table for displaying attachment fields inside a given container.
 *
 * @param {HTMLElement} container - The container element to append the table to.
 * @return {HTMLElement} The table body element (<tbody>).
 */
const createTable = ( container ) => {
	const table = document.createElement( 'table' );
	table.className = `compat-attachment-fields compat-item`;
	container.appendChild( table );

	let tableBody = table.querySelector( 'tbody' );
	if ( ! tableBody ) {
		tableBody = document.createElement( 'tbody' );
		table.appendChild( tableBody );
	}

	return tableBody;
};

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

		const hlsUrl = this.model.get( 'hls_url' );
		const mpdUrl = this.model.get( 'mpd_url' );

		// Skip the local Media Library attachments.
		if ( ( ! mpdUrl || ! isMpd( mpdUrl ) ) && ( ! hlsUrl || ! isM3U8( hlsUrl ) ) ) {
			return this;
		}

		const attachmentId = this.model.get( 'id' );

		// No need to check if table exists, as if it did we would have returned early on link checks.
		const tableBody = createTable( this.el );

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
