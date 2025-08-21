const { __ } = wp.i18n;

const AttachmentDetails = wp?.media?.view?.Attachment?.Details;

const isMpd = ( url ) => typeof url === 'string' && url.trim().toLowerCase().endsWith( '.mpd' );
const isM3U8 = ( url ) => typeof url === 'string' && url.trim().toLowerCase().endsWith( '.m3u8' );

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

const createTable = ( container ) => {
	const tableSelector = '.compat-attachment-fields';
	const table = document.createElement( 'table' );
	table.className = `${ tableSelector } compat-item`;
	container.appendChild( table );

	let tableBody = table.querySelector( 'tbody' );
	if ( ! tableBody ) {
		tableBody = document.createElement( 'tbody' );
		table.appendChild( tableBody );
	}

	return tableBody;
};

export default AttachmentDetails?.extend( {
	initialize() {
		AttachmentDetails.prototype.initialize.apply( this, arguments );
	},

	render() {
		AttachmentDetails.prototype.render.apply( this, arguments );

		const hlsUrl = this.model.get( 'hls_url' );
		const attachmentUrl = this.model.get( 'url' );

		// Skip the local Media Library attachments.
		if ( ( ! attachmentUrl || ! isMpd( attachmentUrl ) ) && ( ! hlsUrl || ! isM3U8( hlsUrl ) ) ) {
			return this;
		}

		const attachmentId = this.model.get( 'id' );
		const tableBody = createTable( this.el );

		if ( attachmentUrl && isMpd( attachmentUrl ) ) {
			tableBody.appendChild(
				createAttachmentField( {
					id: attachmentId,
					fieldName: 'transcoded_url',
					fieldLabel: __( 'Transcoded CDN URL (MPD)', 'godam' ),
					url: attachmentUrl,
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
